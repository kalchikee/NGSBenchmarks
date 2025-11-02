const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs-extra');
const NGSDataFetcher = require('./scripts/fetchNGSData');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Serve static files
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/data', express.static(path.join(__dirname, 'data')));
app.use('/lib', express.static(path.join(__dirname, 'lib')));

// Main route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API Routes for NGS data

// Get available shapefiles
app.get('/api/shapefiles', async (req, res) => {
    try {
        const shapefileDir = path.join(__dirname, 'data', 'shapefiles');
        const processedDir = path.join(__dirname, 'data', 'processed');
        
        if (!await fs.pathExists(shapefileDir)) {
            return res.json([]);
        }

        // Look for processed shapefile data
        const shapefiles = [];
        const files = await fs.readdir(shapefileDir, { withFileTypes: true });
        
        for (const file of files) {
            if (file.name.endsWith('.shp')) {
                // In a full implementation, you would convert shapefile to GeoJSON
                // For now, return metadata
                shapefiles.push({
                    name: file.name,
                    type: 'shapefile',
                    size: (await fs.stat(path.join(shapefileDir, file.name))).size,
                    // data: geoJsonData // Would contain actual converted data
                });
            }
        }
        
        res.json(shapefiles);
    } catch (error) {
        console.error('Error reading shapefiles:', error);
        res.status(500).json({ error: 'Failed to read shapefiles' });
    }
});

// Get available datasheets
app.get('/api/datasheets', async (req, res) => {
    try {
        const datasheetDir = path.join(__dirname, 'data', 'datasheets');
        
        if (!await fs.pathExists(datasheetDir)) {
            return res.json({});
        }

        const datasheets = {};
        const files = await fs.readdir(datasheetDir, { withFileTypes: true });
        
        for (const file of files) {
            if (file.isFile()) {
                datasheets[file.name] = {
                    filename: file.name,
                    path: `/data/datasheets/${file.name}`,
                    size: (await fs.stat(path.join(datasheetDir, file.name))).size
                };
            }
        }
        
        res.json(datasheets);
    } catch (error) {
        console.error('Error reading datasheets:', error);
        res.status(500).json({ error: 'Failed to read datasheets' });
    }
});

// Get specific benchmark datasheet content
app.get('/api/datasheet/:state/:benchmarkId', async (req, res) => {
    try {
        const { state, benchmarkId } = req.params;
        const datasheetFile = path.join(__dirname, 'data', 'datasheets', state, `${state}.txt`);
        
        if (!await fs.pathExists(datasheetFile)) {
            return res.status(404).json({ error: 'Datasheet file not found' });
        }

        // Read the datasheet file and find the specific benchmark entry
        const content = await fs.readFile(datasheetFile, 'utf8');
        
        // Split entries by retrieval date lines (each benchmark starts with this)
        const entries = content.split(/^1\s+National Geodetic Survey, Retrieval Date/gm);
        
        // Find the entry that contains our benchmark ID
        let benchmarkEntry = null;
        for (const entry of entries) {
            if (entry.includes(`PID         -  ${benchmarkId}`)) {
                // Reconstruct the full entry with the retrieval header
                benchmarkEntry = '1    National Geodetic Survey, Retrieval Date' + entry;
                break;
            }
        }
        
        if (benchmarkEntry) {
            res.json({
                benchmarkId,
                state,
                content: benchmarkEntry,
                success: true
            });
        } else {
            res.status(404).json({ 
                error: `Benchmark ${benchmarkId} not found in ${state} datasheet`,
                benchmarkId,
                state
            });
        }
        
    } catch (error) {
        console.error('Error reading datasheet:', error);
        res.status(500).json({ error: 'Failed to read datasheet content' });
    }
});

// Get data inventory
app.get('/api/inventory', async (req, res) => {
    try {
        const inventoryPath = path.join(__dirname, 'data', 'processed', 'inventory.json');
        
        if (await fs.pathExists(inventoryPath)) {
            const inventory = await fs.readJson(inventoryPath);
            res.json(inventory);
        } else {
            res.json({
                datasheets: [],
                shapefiles: [],
                generated: null,
                message: 'No data fetched yet. Run npm run fetch-data to download NGS data.'
            });
        }
    } catch (error) {
        console.error('Error reading inventory:', error);
        res.status(500).json({ error: 'Failed to read inventory' });
    }
});

// Trigger data fetch
app.post('/api/fetch-data', async (req, res) => {
    try {
        const fetcher = new NGSDataFetcher();
        
        // Run in background
        fetcher.run().then(() => {
            console.log('Data fetch completed');
        }).catch(error => {
            console.error('Data fetch failed:', error);
        });
        
        res.json({ message: 'Data fetch started. Check console for progress.' });
    } catch (error) {
        console.error('Error starting data fetch:', error);
        res.status(500).json({ error: 'Failed to start data fetch' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
    console.log(`\n🚀 NGS Benchmark Viewer Server Started!`);
    console.log(`📍 Local:    http://localhost:${PORT}`);
    console.log(`📊 API:      http://localhost:${PORT}/api/health`);
    console.log(`📁 Data:     http://localhost:${PORT}/api/inventory`);
    console.log(`\n💡 To fetch NGS data, run: npm run fetch-data`);
    console.log(`   Or use the API: POST http://localhost:${PORT}/api/fetch-data`);
});

module.exports = app;