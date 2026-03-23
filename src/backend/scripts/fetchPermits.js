const axios = require('axios');
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../../../data/permits.db'));

async function fetchPermitData() {
  console.log('Fetching permit data from Portland Maps...');
  
  try {
    // Note: This is a sample - you'll need to adjust based on actual API
    const response = await axios.get('https://www.portlandmaps.com/reports/index.cfm', {
      params: {
        action: 'address',
        format: 'json'
      }
    });
    
    // For now, we'll insert sample data based on the HTML table we saw
    const samplePermits = [
      {
        address_id: 475733,
        create_date: '2014-08-04',
        change_date: '2026-01-16',
        location: '8023 SE 17TH AVE',
        address_status: 'Active',
        addr_type: 'Commercial',
        house_no: '8023',
        direction: 'SE',
        street: '17TH',
        street_type: 'AVE',
        latitude: 45.46526,
        longitude: -122.64726,
        r_no: 'R267535'
      },
      {
        address_id: 571497,
        create_date: '2014-08-04',
        change_date: '2026-01-02',
        location: '6936 NE 22ND AVE #A',
        address_status: 'Active',
        addr_type: 'Residential',
        house_no: '6936',
        direction: 'NE',
        street: '22ND',
        street_type: 'AVE',
        unit_type: 'MAIN SFR',
        unit: 'A',
        latitude: 45.57312,
        longitude: -122.64317,
        r_no: 'R190974'
      }
    ];
    
    const insert = db.prepare(`
      INSERT OR REPLACE INTO permits (
        address_id, create_date, change_date, location, address_status,
        addr_type, house_no, direction, street, street_type, unit_type,
        unit, latitude, longitude, r_no
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const insertMany = db.transaction((permits) => {
      for (const permit of permits) {
        insert.run(
          permit.address_id,
          permit.create_date,
          permit.change_date,
          permit.location,
          permit.address_status,
          permit.addr_type,
          permit.house_no,
          permit.direction,
          permit.street,
          permit.street_type,
          permit.unit_type,
          permit.unit,
          permit.latitude,
          permit.longitude,
          permit.r_no
        );
      }
    });
    
    insertMany(samplePermits);
    console.log(`Inserted ${samplePermits.length} permits into database`);
    
  } catch (error) {
    console.error('Error fetching permits:', error.message);
  } finally {
    db.close();
  }
}

fetchPermitData();