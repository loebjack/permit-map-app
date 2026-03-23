// src/backend/scripts/fetchAllPermits.js
const axios = require('axios');
const cheerio = require('cheerio');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'https://www.portlandmaps.com/reports/index.cfm';
const CACHE_DIR = path.join(__dirname, '../../../cache');
const DB_PATH = path.join(__dirname, '../../../data/permits.db');

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// All report types to scrape
const REPORT_SOURCES = [
  { action: 'co-intakes', name: 'Commercial Building Permit Intakes' },
  { action: 'co-issued', name: 'Commercial Issued Building Permits' },
  { action: 'fp-issued', name: 'Facility Issued Permits' },
  { action: 'fp-intakes', name: 'Facility Permit Intakes' },
  { action: 'co-lur-intakes', name: 'Commercial Land Use Review Intakes' },
  { action: 'rs-lur-intakes', name: 'Residential Land Use Review Intakes' },
  { action: 'rs-issued', name: 'Residential Issued Building Permits' },
  { action: 'rs-intakes', name: 'Residential Permit Intakes' },
  { action: 'address', name: 'Address History' }
];

class ComprehensivePermitScraper {
  constructor(options = {}) {
    this.db = new Database(DB_PATH);
    this.targetZipCodes = options.zipCodes || null;
    this.setupDatabase();
  }

  setupDatabase() {
    // Create table with all fields (don't drop if it exists)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS permits (
        permit_id TEXT PRIMARY KEY,
        source_type TEXT,
        
        -- Common fields
        address TEXT,
        latitude REAL,
        longitude REAL,
        status TEXT,
        
        -- Building permit fields
        case_number TEXT,
        permit_details_url TEXT,
        work_proposed TEXT,
        type_of_use TEXT,
        description_of_work TEXT,
        valuation INTEGER,
        date_received TEXT,
        date_issued TEXT,
        ivr_number TEXT,
        property_legal_description TEXT,
        permit_info TEXT,
        contractor TEXT,
        owner_1 TEXT,
        owner_2 TEXT,
        applicant_1 TEXT,
        applicant_2 TEXT,
        
        -- Address history fields
        address_id INTEGER,
        create_date TEXT,
        change_date TEXT,
        retired_date TEXT,
        comment TEXT,
        location TEXT,
        address_status TEXT,
        last_bds_edit TEXT,
        addr_type TEXT,
        house_no TEXT,
        direction TEXT,
        street TEXT,
        street_type TEXT,
        unit_type TEXT,
        unit TEXT,
        tlid TEXT,
        r_no TEXT,
        legal_description TEXT,
        state_plane_x REAL,
        state_plane_y REAL,
        
        fetched_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_case_number ON permits(case_number);
      CREATE INDEX IF NOT EXISTS idx_address ON permits(address);
      CREATE INDEX IF NOT EXISTS idx_coordinates ON permits(latitude, longitude);
      CREATE INDEX IF NOT EXISTS idx_status ON permits(status);
      CREATE INDEX IF NOT EXISTS idx_source ON permits(source_type);
      CREATE INDEX IF NOT EXISTS idx_date_received ON permits(date_received);
    `);

    console.log('✓ Database ready');
  }

  async scrapeReport(reportAction, reportName) {
    console.log(`\n=== Scraping ${reportName} ===`);
    let allPermits = [];
    let page = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      try {
        console.log(`Fetching page ${page}...`);
        
        const url = `${BASE_URL}?action=${reportAction}&page=${page}`;
        const response = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
          },
          timeout: 30000
        });

        // Save HTML to cache for debugging
        if (page === 1) {
          const cacheFile = path.join(CACHE_DIR, `${reportAction}_page${page}.html`);
          fs.writeFileSync(cacheFile, response.data);
          console.log(`Saved HTML to: ${cacheFile}`);
        }

        const $ = cheerio.load(response.data);
        
        const isBuildingPermit = reportAction !== 'address';
        
        const table = $('table');
        if (!table.length) {
          console.log('No table found on page');
          break;
        }

        // Extract headers - look for links in the header row
        const headers = [];
        table.find('tr').first().find('th, td').each((i, el) => {
          const $el = $(el);
          const linkText = $el.find('a').text().trim();
          const text = linkText || $el.text().trim();
          if (text) headers.push(text);
        });

        if (headers.length === 0) {
          console.log('No headers found');
          break;
        }

        console.log(`Found ${headers.length} columns:`, headers.slice(0, 5).join(', ') + '...');

        // Extract rows
        let rowCount = 0;
        table.find('tr').slice(1).each((i, row) => {
          const cells = $(row).find('td');
          if (cells.length < 3) return;
          
          const firstCellText = $(cells[0]).text().trim();
          if (firstCellText.includes('Records') || firstCellText.includes('CSV')) return;

          const permit = {};
          cells.each((j, cell) => {
            if (j >= headers.length) return;
            
            const header = headers[j];
            const $cell = $(cell);
            
            const link = $cell.find('a').attr('href');
            if (link && header.includes('PERMIT')) {
              permit['permit_details_url'] = link.startsWith('http') ? link : `https://www.portlandmaps.com${link}`;
            }
            
            permit[header] = $cell.text().trim();
          });

          if (Object.keys(permit).length > 3) {
            const normalized = isBuildingPermit 
              ? this.normalizeBuildingPermit(permit, reportAction)
              : this.normalizeAddressPermit(permit);
            
            if (this.shouldIncludePermit(normalized)) {
              allPermits.push(normalized);
              rowCount++;
            }
          }
        });

        console.log(`Extracted ${rowCount} rows from page ${page}`);

        if (rowCount === 0) {
          hasMorePages = false;
        } else {
          page++;
          const nextLink = $('a:contains(">>")').length > 0 || 
                          $('a:contains("Next")').length > 0;
          if (!nextLink && rowCount < 100) {
            hasMorePages = false;
          }
          
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (error) {
        console.error(`Error on page ${page}:`, error.message);
        hasMorePages = false;
      }
    }

    console.log(`Total permits scraped: ${allPermits.length}`);
    return allPermits;
  }

  shouldIncludePermit(permit) {
    if (!this.targetZipCodes || this.targetZipCodes.length === 0) {
      return true;
    }
    
    const address = permit.address || permit.location || '';
    const zipMatch = address.match(/\b(\d{5})\b/);
    
    // Include permits without zip codes (they might get geocoded later)
    if (!zipMatch) {
      return true;
    }
    
    const zipCode = zipMatch[1];
    return this.targetZipCodes.includes(zipCode);
  }

  normalizeBuildingPermit(permit, sourceType) {
    const address = permit['ADDRESS'] || permit['address'] || '';
    
    return {
      permit_id: permit['CASE NUMBER'] || permit['case_number'] || `${sourceType}-${Date.now()}-${Math.random()}`,
      source_type: sourceType,
      address: address,
      case_number: permit['CASE NUMBER'] || permit['case_number'],
      permit_details_url: permit['permit_details_url'],
      work_proposed: permit['WORK PROPOSED'] || permit['work_proposed'],
      type_of_use: permit['TYPE OF USE'] || permit['type_of_use'],
      description_of_work: permit['DESCRIPTION OF WORK'] || permit['description_of_work'],
      valuation: this.parseNumber(permit['VALUATION'] || permit['valuation']),
      date_received: permit['DATE RECEIVED'] || permit['date_received'],
      date_issued: permit['DATE ISSUED'] || permit['date_issued'],
      status: permit['STATUS'] || permit['status'] || 'Unknown',
      ivr_number: permit['IVR NUMBER'] || permit['ivr_number'],
      property_legal_description: permit['PROPERTY LEGAL DESCRIPTION'] || permit['property_legal_description'],
      permit_info: permit['PERMIT INFO'] || permit['permit_info'],
      contractor: permit['CONTRACTOR'] || permit['contractor'],
      owner_1: permit['OWNER 1'] || permit['owner_1'],
      owner_2: permit['OWNER 2'] || permit['owner_2'],
      applicant_1: permit['APPLICANT 1'] || permit['applicant_1'],
      applicant_2: permit['APPLICANT 2'] || permit['applicant_2'],
      latitude: null,
      longitude: null,
      address_id: null,
      create_date: null,
      change_date: null,
      retired_date: null,
      comment: null,
      location: null,
      address_status: null,
      last_bds_edit: null,
      addr_type: null,
      house_no: null,
      direction: null,
      street: null,
      street_type: null,
      unit_type: null,
      unit: null,
      tlid: null,
      r_no: null,
      legal_description: null,
      state_plane_x: null,
      state_plane_y: null
    };
  }

  normalizeAddressPermit(permit) {
    return {
      permit_id: `addr-${permit['ADDRESS ID'] || permit['address_id'] || Date.now()}`,
      source_type: 'address',
      address: permit['LOCATION'] || permit['location'],
      address_id: this.parseNumber(permit['ADDRESS ID'] || permit['address_id']),
      create_date: permit['CREATE DATE'] || permit['create_date'],
      change_date: permit['CHANGE DATE'] || permit['change_date'],
      retired_date: permit['RETIRED DATE'] || permit['retired_date'],
      comment: permit['COMMENT'] || permit['comment'],
      location: permit['LOCATION'] || permit['location'],
      address_status: permit['ADDRESS STATUS'] || permit['address_status'],
      status: permit['ADDRESS STATUS'] || permit['address_status'],
      last_bds_edit: permit['LAST BDS EDIT'] || permit['last_bds_edit'],
      addr_type: permit['ADDR TYPE'] || permit['addr_type'],
      house_no: permit['HOUSE NO'] || permit['house_no'],
      direction: permit['DIR'] || permit['direction'],
      street: permit['STREET'] || permit['street'],
      street_type: permit['TYPE'] || permit['street_type'],
      unit_type: permit['UNIT TYPE'] || permit['unit_type'],
      unit: permit['UNIT'] || permit['unit'],
      tlid: permit['TLID'] || permit['tlid'],
      r_no: permit['R NO'] || permit['r_no'],
      legal_description: permit['LEGAL DESCRIPTION'] || permit['legal_description'],
      latitude: parseFloat(permit['LATITUDE'] || permit['latitude']) || null,
      longitude: parseFloat(permit['LONGITUDE'] || permit['longitude']) || null,
      state_plane_x: parseFloat(permit['OR STATE PLANE X'] || permit['state_plane_x']) || null,
      state_plane_y: parseFloat(permit['OR STATE PLANE Y'] || permit['state_plane_y']) || null,
      case_number: null,
      permit_details_url: null,
      work_proposed: null,
      type_of_use: null,
      description_of_work: null,
      valuation: null,
      date_received: null,
      date_issued: null,
      ivr_number: null,
      property_legal_description: null,
      permit_info: null,
      contractor: null,
      owner_1: null,
      owner_2: null,
      applicant_1: null,
      applicant_2: null
    };
  }

  parseNumber(str) {
    if (!str) return null;
    const num = parseInt(str.replace(/[^0-9-]/g, ''));
    return isNaN(num) ? null : num;
  }

  async geocodeAddress(address) {
    if (!address) return { latitude: null, longitude: null };
    
    try {
      const query = `${address}, Portland, Oregon`;
      const response = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: query,
          format: 'json',
          limit: 1
        },
        headers: {
          'User-Agent': 'PermitMapApp/1.0'
        }
      });

      if (response.data && response.data.length > 0) {
        return {
          latitude: parseFloat(response.data[0].lat),
          longitude: parseFloat(response.data[0].lon)
        };
      }
    } catch (error) {
      // Fail silently
    }
    
    return { latitude: null, longitude: null };
  }

  async savePermits(permits) {
    console.log(`\nProcessing ${permits.length} permits...`);
    
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO permits (
        permit_id, source_type, address, latitude, longitude, status,
        case_number, permit_details_url, work_proposed, type_of_use, 
        description_of_work, valuation, date_received, date_issued,
        ivr_number, property_legal_description, permit_info, contractor,
        owner_1, owner_2, applicant_1, applicant_2,
        address_id, create_date, change_date, retired_date, comment,
        location, address_status, last_bds_edit, addr_type, house_no,
        direction, street, street_type, unit_type, unit, tlid, r_no,
        legal_description, state_plane_x, state_plane_y
      ) VALUES (
        @permit_id, @source_type, @address, @latitude, @longitude, @status,
        @case_number, @permit_details_url, @work_proposed, @type_of_use,
        @description_of_work, @valuation, @date_received, @date_issued,
        @ivr_number, @property_legal_description, @permit_info, @contractor,
        @owner_1, @owner_2, @applicant_1, @applicant_2,
        @address_id, @create_date, @change_date, @retired_date, @comment,
        @location, @address_status, @last_bds_edit, @addr_type, @house_no,
        @direction, @street, @street_type, @unit_type, @unit, @tlid, @r_no,
        @legal_description, @state_plane_x, @state_plane_y
      )
    `);

    let saved = 0;
    let geocoded = 0;
    let failed = 0;

    const batchSize = 10;
    for (let i = 0; i < permits.length; i += batchSize) {
      const batch = permits.slice(i, i + batchSize);
      
      for (const permit of batch) {
        try {
          if (!permit.latitude && !permit.longitude && permit.address) {
            const coords = await this.geocodeAddress(permit.address);
            permit.latitude = coords.latitude;
            permit.longitude = coords.longitude;
            if (coords.latitude) {
              geocoded++;
            } else {
              failed++;
            }
            await new Promise(resolve => setTimeout(resolve, 1100));
          }

          insert.run(permit);
          saved++;
        } catch (error) {
          console.error(`Error saving ${permit.permit_id}:`, error.message);
        }
      }
      
      console.log(`Progress: ${Math.min(i + batchSize, permits.length)}/${permits.length} processed, ${saved} saved, ${geocoded} geocoded, ${failed} failed`);
    }

    console.log(`\n✓ Saved ${saved} permits (${geocoded} geocoded successfully, ${failed} geocoding failed)`);
  }

  async fetchAllReports() {
    const startTime = Date.now();
    const results = {};

    for (const source of REPORT_SOURCES) {
      try {
        const permits = await this.scrapeReport(source.action, source.name);
        await this.savePermits(permits);
        results[source.name] = permits.length;
      } catch (error) {
        console.error(`Failed to fetch ${source.name}:`, error.message);
        results[source.name] = 0;
      }
    }

    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    Object.entries(results).forEach(([name, count]) => {
      console.log(`${name.padEnd(50)} ${count}`);
    });
    console.log('='.repeat(60));
    console.log(`Total time: ${duration} minutes`);
    console.log('='.repeat(60));

    return results;
  }

  getStats() {
    const total = this.db.prepare('SELECT COUNT(*) as count FROM permits').get();
    const bySource = this.db.prepare(`
      SELECT source_type, COUNT(*) as count 
      FROM permits 
      GROUP BY source_type
    `).all();
    const withCoords = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM permits 
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    `).get();

    return { total: total.count, withCoordinates: withCoords.count, bySource };
  }

  close() {
    this.db.close();
  }
}

// Main execution
async function main() {
  // Define target zip codes
  const TARGET_ZIP_CODES = ['97206', '97213', '97215', '97216', '97220', '97266'];
  
  const scraper = new ComprehensivePermitScraper({
    zipCodes: TARGET_ZIP_CODES
  });

  try {
    const args = process.argv.slice(2);

    console.log(`\n🎯 Filtering to zip codes: ${TARGET_ZIP_CODES.join(', ')}\n`);

    if (args.includes('--stats')) {
      const stats = scraper.getStats();
      console.log('\n=== Database Statistics ===');
      console.log(`Total permits: ${stats.total}`);
      console.log(`With coordinates: ${stats.withCoordinates}`);
      console.log('\nBy Source:');
      stats.bySource.forEach(({ source_type, count }) => {
        console.log(`  ${source_type}: ${count}`);
      });
    } else if (args[0]) {
      const source = REPORT_SOURCES.find(s => s.action === args[0]);
      if (source) {
        const permits = await scraper.scrapeReport(source.action, source.name);
        await scraper.savePermits(permits);
      } else {
        console.log('Unknown report type. Available:');
        REPORT_SOURCES.forEach(s => console.log(`  ${s.action}`));
      }
    } else {
      await scraper.fetchAllReports();
    }

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    scraper.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = ComprehensivePermitScraper;