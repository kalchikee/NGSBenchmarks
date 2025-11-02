# NGS Benchmark Data Viewer

An interactive web application for exploring National Geodetic Survey (NGS) benchmark data with integrated shapefile visualization and address-based search capabilities.

## Features

### 🗺️ Interactive Mapping
- **Leaflet-based map** with multiple base layers (OpenStreetMap, Topographic, Satellite)
- **Pan and zoom** functionality for exploring different regions
- **Responsive design** that works on desktop and mobile devices

### 📍 NGS Benchmark Integration
- **Automatic data fetching** from NGS datasheet archives
- **Shapefile loading** and visualization from NGS archives
- **Multiple benchmark types** with distinct symbology:
  - Horizontal Control Points (Red circles)
  - Vertical Control Points (Blue triangles)
  - Gravity Stations (Purple diamonds)
  - CORS Stations (Orange squares)
  - Triangulation Stations (Green triangles)

### 🔍 Advanced Search & Filtering
- **Address search** to find nearest benchmarks to any location
- **Type filtering** to display specific benchmark categories
- **Interactive popups** with detailed benchmark information
- **Datasheet integration** for accessing detailed survey data

### 📊 Data Management
- **Automated downloading** and extraction of NGS archives
- **Real-time inventory** of available data
- **Background processing** of large datasets
- **Error handling** and status reporting

## Quick Start

### Prerequisites
- **Node.js** (version 14 or higher)
- **npm** (comes with Node.js)

### Installation

1. **Clone or download** this project to your local machine

2. **Navigate to the project directory:**
   ```bash
   cd "NGS Project"
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Start the server:**
   ```bash
   npm start
   ```

5. **Open your browser** and go to:
   ```
   http://localhost:3000
   ```

### Fetching NGS Data

To download actual NGS data (optional - the app works with sample data):

```bash
npm run fetch-data
```

This will:
- Download datasheet archives from NGS
- Download and extract shapefile data
- Create a local inventory of available data

## Usage Guide

### Exploring Benchmarks
1. **View the map** - Sample benchmarks are loaded automatically
2. **Click markers** to see detailed information
3. **Use the legend** to understand different benchmark types

### Searching for Nearest Benchmark
1. **Enter an address** in the search box (e.g., "1600 Pennsylvania Ave, Washington DC")
2. **Click Search** or press Enter
3. **View results** showing the nearest benchmark with distance
4. **Click "Show on Map"** to zoom to the benchmark location

### Filtering by Type
1. **Use the dropdown menu** to select a specific benchmark type
2. **Choose from:**
   - All Types (default)
   - Horizontal Control
   - Vertical Control
   - Gravity Station
   - CORS Station
   - Triangulation Station

### Map Controls
- **Center on US** - Reset map view to continental United States
- **Toggle Layers** - Show/hide shapefile overlays (when available)
- **Zoom Level** - Current zoom level indicator

## API Endpoints

The server provides several API endpoints for data access:

- `GET /api/health` - Server health check
- `GET /api/inventory` - Data inventory status
- `GET /api/shapefiles` - Available shapefile data
- `GET /api/datasheets` - Available datasheet files
- `POST /api/fetch-data` - Trigger data download

## File Structure

```
NGS Project/
├── index.html              # Main HTML file
├── server.js              # Express.js server
├── package.json           # Node.js dependencies
├── css/
│   └── style.css         # Application styles
├── js/
│   └── main.js           # Main JavaScript application
├── scripts/
│   └── fetchNGSData.js   # NGS data fetching script
├── data/                 # Downloaded and processed data
│   ├── datasheets/      # NGS datasheet files
│   ├── shapefiles/      # NGS shapefile archives
│   └── processed/       # Processed data and inventory
└── lib/
    └── leaflet/         # Leaflet mapping library
```

## Data Sources

This application fetches data from official NGS sources:

- **Datasheets:** https://geodesy.noaa.gov/pub/DS_ARCHIVE/DataSheets/
- **Shapefiles:** https://www.ngs.noaa.gov/cgi-bin/sf_archive.prl

## Technology Stack

- **Frontend:** HTML5, CSS3, JavaScript (ES6+)
- **Mapping:** Leaflet.js with multiple tile providers
- **Backend:** Node.js with Express.js
- **Data Processing:** Custom scripts for NGS data integration
- **Geocoding:** OpenStreetMap Nominatim service

## Browser Compatibility

- Chrome (recommended)
- Firefox
- Safari
- Edge

## Troubleshooting

### Data Not Loading
1. Check your internet connection
2. Run `npm run fetch-data` to download data
3. Check console for error messages

### Map Not Displaying
1. Ensure JavaScript is enabled
2. Check browser console for errors
3. Verify port 3000 is not in use

### Search Not Working
1. Verify address format (include city, state)
2. Check internet connection for geocoding service
3. Try a well-known address as a test

## Development

### Adding New Features
1. Modify `js/main.js` for frontend functionality
2. Update `server.js` for backend API changes
3. Extend `css/style.css` for styling updates

### Data Processing
The `scripts/fetchNGSData.js` file handles:
- Scraping NGS archive pages
- Downloading zip files
- Extracting and organizing data
- Creating inventory files

### Custom Benchmark Types
To add new benchmark types, update the `benchmarkTypes` object in `main.js` with:
- Color scheme
- Icon representation  
- Size parameters

## License

This project is for educational and research purposes. NGS data is provided by NOAA's National Ocean Service and is in the public domain.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues or questions:
1. Check the console for error messages
2. Verify all dependencies are installed
3. Ensure Node.js version compatibility
4. Check network connectivity for data fetching

---

**Built for exploring America's geodetic infrastructure** 🇺🇸

*This application provides an interactive way to explore the National Geodetic Survey's benchmark network, helping users understand the precise coordinate system that underlies all mapping and surveying in the United States.*