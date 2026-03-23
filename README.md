# Portland Permit Map Generator

A desktop application that scrapes building permit data from Portland Maps and displays it on an interactive map. Built with Electron, React, and Leaflet.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)

## Features

- 🗺️ **Interactive Map** - Visualize permits on an OpenStreetMap-based interface
- 📍 **Automatic Geocoding** - Converts addresses to coordinates using free OSM Nominatim API
- 🔍 **Advanced Filtering** - Filter by date range, permit type, and more
- 🎯 **Zip Code Filtering** - Focus on specific Portland zip codes (97206, 97213, 97215, 97216, 97220, 97266)
- 💾 **Local SQLite Database** - All data stored locally with spatial indexing
- 📊 **Multiple Data Sources** - Scrapes from 9 different Portland Maps report types
- 🌐 **Network Access** - Host on your local network for multi-device access
- 🔄 **Incremental Updates** - Add new permits without losing historical data
- 📱 **Desktop App** - Native macOS and Linux desktop application via Electron

## Screenshots

### Interactive Map View
Click on markers to see detailed permit information including:
- Case number and permit details link
- Work description
- Valuation
- Contractor information
- Legal description

### Sidebar Filters
- Date range filtering
- Permit type selection
- Real-time statistics
- Search functionality

## Tech Stack

- **Frontend**: React, Leaflet.js, Vite
- **Backend**: Node.js, Express
- **Database**: SQLite with spatial indexing
- **Desktop**: Electron
- **Scraping**: Axios, Cheerio
- **Geocoding**: OpenStreetMap Nominatim (free, no API key required)

## Installation

### Prerequisites

- Node.js 18+ ([Download](https://nodejs.org/))
- Git

**For Arch Linux users:**
```bash
sudo pacman -S nodejs npm base-devel python
```

**For macOS users:**
```bash
brew install node
```

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/loebjack/permit-map-app.git
   cd permit-map-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Initialize the database**
   ```bash
   npm run db:init
   ```

4. **Fetch permit data**
   ```bash
   # Fetch from one source (recommended for testing)
   node src/backend/scripts/fetchAllPermits.js co-intakes
   
   # Or fetch from all sources (takes 20-30 minutes)
   npm run data:fetch
   ```

5. **Start the application**
   ```bash
   npm run dev
   ```

6. **Open in browser**
   ```
   http://localhost:5173
   ```

## Usage

### Running the App

```bash
# Development mode (with hot reload)
npm run dev

# View database statistics
npm run data:stats

# Initialize/reset database
npm run db:init
```

### Fetching Permit Data

The scraper is configured to fetch permits from these zip codes:
- 97206, 97213, 97215, 97216, 97220, 97266
- Plus any permits without a zip code

**Available data sources:**
```bash
# Commercial Building Permit Intakes
node src/backend/scripts/fetchAllPermits.js co-intakes

# Commercial Issued Building Permits
node src/backend/scripts/fetchAllPermits.js co-issued

# Residential Issued Building Permits
node src/backend/scripts/fetchAllPermits.js rs-issued

# Residential Permit Intakes
node src/backend/scripts/fetchAllPermits.js rs-intakes

# Facility Permits
node src/backend/scripts/fetchAllPermits.js fp-issued
node src/backend/scripts/fetchAllPermits.js fp-intakes

# Land Use Reviews
node src/backend/scripts/fetchAllPermits.js co-lur-intakes
node src/backend/scripts/fetchAllPermits.js rs-lur-intakes

# Address History (has coordinates already)
node src/backend/scripts/fetchAllPermits.js address

# Fetch all sources
npm run data:fetch
```

### Network Access

To access the app from other devices on your network:

1. **Open firewall ports:**
   ```bash
   # Arch Linux (ufw)
   sudo ufw allow 3000/tcp
   sudo ufw allow 5173/tcp
   
   # Or firewalld
   sudo firewall-cmd --permanent --add-port=3000/tcp
   sudo firewall-cmd --permanent --add-port=5173/tcp
   sudo firewall-cmd --reload
   ```

2. **Update frontend config:**
   
   Edit `src/frontend/config.js`:
   ```javascript
   export const API_URL = 'http://YOUR_IP_ADDRESS:3000/api';
   ```

3. **Start the server:**
   ```bash
   npm run dev
   ```

4. **Access from other devices:**
   ```
   http://YOUR_IP_ADDRESS:5173
   ```

## Building for Production

### macOS
```bash
npm run build
npm run build:mac
```
Output: `dist/permit-map-app.dmg`

### Linux
```bash
npm run build
npm run build:linux
```
Output: `dist/permit-map-app.AppImage` or `.deb`

## Project Structure

```
permit-map-app/
├── src/
│   ├── backend/
│   │   ├── server.js              # Express API server
│   │   └── scripts/
│   │       ├── initDatabase.js    # Database initialization
│   │       └── fetchAllPermits.js # Web scraper
│   └── frontend/
│       ├── App.jsx                # Main React component
│       ├── config.js              # API configuration
│       ├── components/
│       │   ├── Map.jsx            # Leaflet map component
│       │   └── Sidebar.jsx        # Filter sidebar
│       └── main.jsx
├── data/
│   └── permits.db                 # SQLite database
├── cache/                         # Cached scraper responses
├── exports/                       # Generated map exports
├── electron.js                    # Electron main process
├── vite.config.js                 # Vite configuration
└── package.json

```

## API Endpoints

### Get Permits
```
GET /api/permits
Query params:
  - startDate: YYYY-MM-DD
  - endDate: YYYY-MM-DD
  - permitType: Residential|Commercial
  - sourceType: co-intakes|rs-issued|etc
```

### Get Permit by ID
```
GET /api/permits/:id
```

### Get Statistics
```
GET /api/stats
```

## Configuration

### Change Target Zip Codes

Edit `src/backend/scripts/fetchAllPermits.js`:

```javascript
const TARGET_ZIP_CODES = ['97206', '97213', '97215', '97216', '97220', '97266'];
```

### Change Geocoding Rate Limit

Edit the delay in `fetchAllPermits.js`:

```javascript
await new Promise(resolve => setTimeout(resolve, 1100)); // 1.1 seconds
```

## Database Schema

The SQLite database includes these main fields:

**Common Fields:**
- `permit_id`, `source_type`, `address`, `latitude`, `longitude`, `status`

**Building Permit Fields:**
- `case_number`, `work_proposed`, `type_of_use`, `description_of_work`
- `valuation`, `date_received`, `date_issued`
- `contractor`, `owner_1`, `owner_2`, `applicant_1`, `applicant_2`

**Address History Fields:**
- `address_id`, `create_date`, `change_date`, `comment`
- `addr_type`, `house_no`, `street`, `r_no`

## Troubleshooting

### No permits showing on map
- Check browser console for errors (F12)
- Verify database has permits with coordinates: `npm run data:stats`
- Ensure API is accessible: `curl http://localhost:3000/api/stats`

### Geocoding failures
- Nominatim has a rate limit of 1 request/second (scraper handles this)
- Some addresses may not be found - this is normal
- Permits without coordinates won't appear on the map

### Network access not working
- Verify firewall ports are open: `sudo ufw status`
- Check if services are listening: `ss -tuln | grep -E ':(3000|5173)'`
- Update `src/frontend/config.js` with correct IP address

### Database errors
- Reinitialize database: `npm run db:init`
- This will delete all existing data

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Data Source

All permit data is sourced from [Portland Maps Reports](https://www.portlandmaps.com/reports/).

**Respect the source:**
- The scraper includes rate limiting (2 seconds between pages)
- Data is cached to minimize requests
- Don't abuse the service

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Portland Maps for providing public permit data
- OpenStreetMap for free geocoding via Nominatim
- Leaflet.js for the mapping library

## Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Check existing issues for solutions

## Roadmap

- [ ] PDF export functionality
- [ ] Advanced search filters
- [ ] Permit status tracking
- [ ] Email notifications for new permits
- [ ] Heat map visualization
- [ ] Multi-city support

---

**Note**: This is an independent project and is not affiliated with the City of Portland or Portland Maps.
