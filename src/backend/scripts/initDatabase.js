// src/backend/scripts/initDatabase.js
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'permits.db');

// Delete existing database to start fresh
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('Deleted old database');
}

const db = new Database(dbPath);

console.log('Creating new database with comprehensive schema...');

// Create permits table with ALL fields
db.exec(`
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

console.log('Created permits table');

// Create indexes
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_case_number ON permits(case_number);
  CREATE INDEX IF NOT EXISTS idx_address ON permits(address);
  CREATE INDEX IF NOT EXISTS idx_coordinates ON permits(latitude, longitude);
  CREATE INDEX IF NOT EXISTS idx_status ON permits(status);
  CREATE INDEX IF NOT EXISTS idx_source ON permits(source_type);
  CREATE INDEX IF NOT EXISTS idx_date_received ON permits(date_received);
`);

console.log('Created indexes');

// Verify table structure
const tableInfo = db.prepare("PRAGMA table_info(permits)").all();
console.log(`\n✓ Database initialized with ${tableInfo.length} columns`);

db.close();