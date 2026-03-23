// src/backend/scripts/fetchPermitsCSV.js
const axios = require('axios');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'https://www.portlandmaps.com/reports/index.cfm';
const CACHE_DIR = path.join(__dirname, '../../../cache');
const DB_PATH = path.join(__dirname, '../../../data/permits.db');

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

class CSVPermitScraper {
  constructor() {
    this.db = new Database(DB_PATH);
  }

  /**
   * Fetch permits as CSV from Portland Maps
   */
  async fetchCSV(reportType = 'address', options = {}) {
    try {
      console.log(`Fetching ${reportType} permits as CSV...`);

      // Build the URL - Portland Maps uses links like:
      // /reports/index.cfm?&format=csv&action=address
      const params = new URLSearchParams({
        action: reportType,
        format: 'csv'
      });

      // Add any filters
      if (options.startDate) params.append('start_date', options.startDate);
      if (options.endDate) params.append('end_date', options.endDate);

      const url = `${BASE_URL}?${params.toString()}`;
      console.log('Fetching from:', url);

      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/csv, application/csv, */*'
        },
        timeout: 60000, // 60 second timeout for large datasets
        responseType: 'text'
      });

      // Cache the CSV
      const timestamp = new Date().toISOString().split('T')[0];
      const cacheFile = path.join(CACHE_DIR, `${reportType}_${timestamp}.csv`);
      fs.writeFileSync(cacheFile, response.data);
      console.log(`Cached CSV to: ${cacheFile}`);

      // Parse CSV
      const permits = this.parseCSV(response.data);
      console.log(`Parsed ${permits.length} permits from CSV`);

      // Save to database
      if (permits.length > 0) {
        this.savePermits(permits);
        console.log(`✓ Saved ${permits.length} permits to database`);
      }

      return permits;

    } catch (error) {
      console.error('Error fetching CSV:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response headers:', error.response.headers);
      }
      throw error;
    }
  }

  /**
   * Parse CSV data
   */
  parseCSV(csvText) {
    const lines = csvText.split('\n');
    if (lines.length < 2) return [];

    // Get headers from first line
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const permits = [];

    // Parse data lines
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Handle CSV with quoted values
      const values = this.parseCSVLine(line);
      if (values.length !== headers.length) continue;

      const permit = {};
      headers.forEach((header, index) => {
        permit[header] = values[index];
      });

      // Normalize to our schema
      const normalized = this.normalizePermit(permit);
      if (normalized.address_id) {
        permits.push(normalized);
      }
    }

    return permits;
  }

  /**
   * Parse a single CSV line, handling quoted values
   */
  parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    return values.map(v => v.replace(/^"|"$/g, ''));
  }

  /**
   * Normalize permit object
   */
  normalizePermit(permit) {
    // Map CSV column names to database fields
    const getValue = (key) => {
      return permit[key] || 
             permit[key.toUpperCase()] || 
             permit[key.toLowerCase()] || 
             null;
    };

    return {
      address_id: parseInt(getValue('ADDRESS ID') || getValue('ADDRESS_ID')) || null,
      create_date: getValue('CREATE DATE') || getValue('CREATE_DATE'),
      change_date: getValue('CHANGE DATE') || getValue('CHANGE_DATE'),
      retired_date: getValue('RETIRED DATE') || getValue('RETIRED_DATE'),
      comment: getValue('COMMENT'),
      location: getValue('LOCATION'),
      address_status: getValue('ADDRESS STATUS') || getValue('ADDRESS_STATUS') || 'Active',
      last_bds_edit: getValue('LAST BDS EDIT') || getValue('LAST_BDS_EDIT'),
      addr_type: getValue('ADDR TYPE') || getValue('ADDR_TYPE') || 'Residential',
      house_no: getValue('HOUSE NO') || getValue('HOUSE_NO'),
      direction: getValue('DIR'),
      street: getValue('STREET'),
      street_type: getValue('TYPE'),
      unit_type: getValue('UNIT TYPE') || getValue('UNIT_TYPE'),
      unit: getValue('UNIT'),
      tlid: getValue('TLID'),
      r_no: getValue('R NO') || getValue('R_NO'),
      legal_description: getValue('LEGAL DESCRIPTION') || getValue('LEGAL_DESCRIPTION'),
      latitude: parseFloat(getValue('LATITUDE')) || null,
      longitude: parseFloat(getValue('LONGITUDE')) || null,
      state_plane_x: parseFloat(getValue('OR STATE PLANE X') || getValue('OR_STATE_PLANE_X')) || null,
      state_plane_y: parseFloat(getValue('OR STATE PLANE Y') || getValue('OR_STATE_PLANE_Y')) || null
    };
  }

  /**
   * Save permits to database
   */
  savePermits(permits) {
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO permits (
        address_id, create_date, change_date, retired_date, comment,
        location, address_status, last_bds_edit, addr_type, house_no,
        direction, street, street_type, unit_type, unit, tlid, r_no,
        legal_description, latitude, longitude, state_plane_x, state_plane_y
      ) VALUES (
        @address_id, @create_date, @change_date, @retired_date, @comment,
        @location, @address_status, @last_bds_edit, @addr_type, @house_no,
        @direction, @street, @street_type, @unit_type, @unit, @tlid, @r_no,
        @legal_description, @latitude, @longitude, @state_plane_x, @state_plane_y
      )
    `);

    const insertMany = this.db.transaction((permits) => {
      let inserted = 0;
      for (const permit of permits) {
        // Only insert if we have valid coordinates
        if (permit.latitude && permit.longitude && permit.address_id) {
          try {
            insert.run(permit);
            inserted++;
          } catch (err) {
            console.error(`Error inserting permit ${permit.address_id}:`, err.message);
          }
        }
      }
      return inserted;
    });

    const count = insertMany(permits);
    console.log(`Inserted ${count} permits with valid coordinates`);
  }

  /**
   * Fetch multiple report types
   */
  async fetchAllReports() {
    const reports = [
      'address',
      'co-intakes',
      'co-issued',
      'rs-intakes',
      'rs-issued',
      'accessory-dwelling-unit'
    ];

    const results = {};

    for (const report of reports) {
      console.log(`\n=== Fetching ${report} ===`);
      try {
        const permits = await this.fetchCSV(report);
        results[report] = permits.length;
        
        // Wait 3 seconds between requests
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (error) {
        console.error(`Failed to fetch ${report}:`, error.message);
        results[report] = 0;
      }
    }

    console.log('\n=== Summary ===');
    Object.entries(results).forEach(([report, count]) => {
      console.log(`${report}: ${count} permits`);
    });

    return results;
  }

  /**
   * Get statistics about stored permits
   */
  getStats() {
    const total = this.db.prepare('SELECT COUNT(*) as count FROM permits').get();
    const byType = this.db.prepare(`
      SELECT addr_type, COUNT(*) as count 
      FROM permits 
      WHERE addr_type IS NOT NULL 
      GROUP BY addr_type
    `).all();
    const byStatus = this.db.prepare(`
      SELECT address_status, COUNT(*) as count 
      FROM permits 
      WHERE address_status IS NOT NULL 
      GROUP BY address_status
    `).all();
    const withCoords = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM permits 
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    `).get();

    return {
      total: total.count,
      withCoordinates: withCoords.count,
      byType,
      byStatus
    };
  }

  close() {
    this.db.close();
  }
}

// Main execution
async function main() {
  const scraper = new CSVPermitScraper();

  try {
    const args = process.argv.slice(2);

    if (args.includes('--stats')) {
      // Show database statistics
      const stats = scraper.getStats();
      console.log('\n=== Database Statistics ===');
      console.log(`Total permits: ${stats.total}`);
      console.log(`With coordinates: ${stats.withCoordinates}`);
      console.log('\nBy Type:');
      stats.byType.forEach(({ addr_type, count }) => {
        console.log(`  ${addr_type}: ${count}`);
      });
      console.log('\nBy Status:');
      stats.byStatus.forEach(({ address_status, count }) => {
        console.log(`  ${address_status}: ${count}`);
      });
    } else if (args.includes('--all')) {
      // Fetch all report types
      await scraper.fetchAllReports();
    } else {
      // Fetch specific report (default: address history)
      const reportType = args[0] || 'address';
      await scraper.fetchCSV(reportType);
    }

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    scraper.close();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = CSVPermitScraper;