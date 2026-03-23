const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const db = new Database(path.join(__dirname, '../../data/permits.db'));

// Routes
app.get('/api/permits', (req, res) => {
  try {
    const { startDate, endDate, permitType, sourceType, requireCoords } = req.query;
    
    let query = 'SELECT * FROM permits WHERE 1=1';
    const params = [];
    
    // Optionally require coordinates (default: show all)
    if (requireCoords === 'true') {
      query += ' AND latitude IS NOT NULL AND longitude IS NOT NULL';
    }
    
    if (startDate) {
      query += ' AND (date_received >= ? OR change_date >= ?)';
      params.push(startDate, startDate);
    }
    if (endDate) {
      query += ' AND (date_received <= ? OR change_date <= ?)';
      params.push(endDate, endDate);
    }
    if (permitType) {
      query += ' AND (addr_type = ? OR type_of_use LIKE ?)';
      params.push(permitType, `%${permitType}%`);
    }
    if (sourceType) {
      query += ' AND source_type = ?';
      params.push(sourceType);
    }
    
    query += ' ORDER BY COALESCE(date_received, change_date) DESC LIMIT 1000';
    
    const stmt = db.prepare(query);
    const permits = stmt.all(...params);
    
    console.log(`API: Returning ${permits.length} permits`);
    
    res.json({ success: true, data: permits, count: permits.length });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/permits/:id', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM permits WHERE permit_id = ? OR address_id = ?');
    const permit = stmt.get(req.params.id, req.params.id);
    
    if (!permit) {
      return res.status(404).json({ success: false, error: 'Permit not found' });
    }
    
    res.json({ success: true, data: permit });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/stats', (req, res) => {
  try {
    const total = db.prepare('SELECT COUNT(*) as count FROM permits').get();
    const withCoords = db.prepare('SELECT COUNT(*) as count FROM permits WHERE latitude IS NOT NULL AND longitude IS NOT NULL').get();
    const bySource = db.prepare('SELECT source_type, COUNT(*) as count FROM permits GROUP BY source_type').all();
    const byStatus = db.prepare('SELECT status, COUNT(*) as count FROM permits WHERE status IS NOT NULL GROUP BY status').all();
    
    res.json({ 
      success: true, 
      data: { 
        total: total.count,
        withCoordinates: withCoords.count,
        bySource,
        byStatus
      } 
    });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  // Get local IP address
  const networkInterfaces = os.networkInterfaces();
  let localIP = 'localhost';
  
  for (const interfaceName in networkInterfaces) {
    for (const iface of networkInterfaces[interfaceName]) {
      // Skip internal and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        localIP = iface.address;
        break;
      }
    }
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('Server running on:');
  console.log(`  Local:    http://localhost:${PORT}`);
  console.log(`  Network:  http://${localIP}:${PORT}`);
  console.log(`${'='.repeat(60)}\n`);
  
  // Log some stats on startup
  try {
    const total = db.prepare('SELECT COUNT(*) as count FROM permits').get();
    const withCoords = db.prepare('SELECT COUNT(*) as count FROM permits WHERE latitude IS NOT NULL AND longitude IS NOT NULL').get();
    console.log(`Database: ${total.count} total permits, ${withCoords.count} with coordinates`);
  } catch (err) {
    console.error('Database check failed:', err.message);
  }
});