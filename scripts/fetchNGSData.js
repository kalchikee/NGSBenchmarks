const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs-extra');
const path = require('path');
const AdmZip = require('adm-zip');

class NGSDataFetcher {
    constructor() {
        this.baseDatasheetUrl = 'https://geodesy.noaa.gov/pub/DS_ARCHIVE/DataSheets/';
        this.baseShapefileUrl = 'https://www.ngs.noaa.gov/cgi-bin/sf_archive.prl';
        this.dataDir = path.join(__dirname, '..', 'data');
        this.datasheetDir = path.join(this.dataDir, 'datasheets');
        this.shapefileDir = path.join(this.dataDir, 'shapefiles');
        this.processedDir = path.join(this.dataDir, 'processed');
    }

    async init() {
        // Ensure directories exist
        await fs.ensureDir(this.dataDir);
        await fs.ensureDir(this.datasheetDir);
        await fs.ensureDir(this.shapefileDir);
        await fs.ensureDir(this.processedDir);
        console.log('Initialized directory structure');
    }

    async fetchDatasheetIndex() {
        try {
            console.log('Fetching datasheet index from NGS...');
            const response = await axios.get(this.baseDatasheetUrl);
            const $ = cheerio.load(response.data);
            
            const files = [];
            $('a[href]').each((i, element) => {
                const href = $(element).attr('href');
                if (href && (href.endsWith('.zip') || href.endsWith('.txt'))) {
                    files.push({
                        name: href,
                        url: this.baseDatasheetUrl + href
                    });
                }
            });

            console.log(`Found ${files.length} datasheet files`);
            return files;
        } catch (error) {
            console.error('Error fetching datasheet index:', error.message);
            return [];
        }
    }

    async fetchShapefileIndex() {
        try {
            console.log('Fetching shapefile index from NGS...');
            
            // First, let's try to get the main archive page
            const response = await axios.get(this.baseShapefileUrl);
            const $ = cheerio.load(response.data);
            
            const files = [];
            
            // Look for downloadable files (zip files typically)
            $('a[href]').each((i, element) => {
                const href = $(element).attr('href');
                const text = $(element).text();
                
                if (href && href.includes('.zip')) {
                    files.push({
                        name: text.trim() || href.split('/').pop(),
                        url: href.startsWith('http') ? href : `https://www.ngs.noaa.gov${href}`
                    });
                }
            });

            // Also check for common NGS shapefile patterns
            const commonShapefiles = [
                'https://www.ngs.noaa.gov/PC_PROD/USGG2012/shapefiles/USGG2012_shapefiles.zip',
                'https://www.ngs.noaa.gov/GEOID/GEOID18/shapefiles.zip'
            ];

            for (const url of commonShapefiles) {
                try {
                    const headResponse = await axios.head(url);
                    if (headResponse.status === 200) {
                        files.push({
                            name: url.split('/').pop(),
                            url: url
                        });
                    }
                } catch (e) {
                    // File might not exist, continue
                }
            }

            console.log(`Found ${files.length} shapefile archives`);
            return files;
        } catch (error) {
            console.error('Error fetching shapefile index:', error.message);
            return [];
        }
    }

    async downloadFile(fileInfo, targetDir, maxSize = 100 * 1024 * 1024) { // 100MB limit
        try {
            const filePath = path.join(targetDir, fileInfo.name);
            
            // Check if file already exists
            if (await fs.pathExists(filePath)) {
                console.log(`File already exists: ${fileInfo.name}`);
                return filePath;
            }

            console.log(`Downloading: ${fileInfo.name}...`);
            
            const response = await axios({
                method: 'GET',
                url: fileInfo.url,
                responseType: 'stream',
                timeout: 30000, // 30 second timeout
                maxContentLength: maxSize,
                maxBodyLength: maxSize
            });

            // Check file size
            const contentLength = parseInt(response.headers['content-length'] || '0');
            if (contentLength > maxSize) {
                console.log(`Skipping large file: ${fileInfo.name} (${Math.round(contentLength / 1024 / 1024)}MB)`);
                return null;
            }

            const writer = fs.createWriteStream(filePath);
            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    console.log(`Downloaded: ${fileInfo.name}`);
                    resolve(filePath);
                });
                writer.on('error', reject);
            });

        } catch (error) {
            console.error(`Error downloading ${fileInfo.name}:`, error.message);
            return null;
        }
    }

    async extractZipFile(zipPath, extractDir) {
        try {
            console.log(`Extracting: ${path.basename(zipPath)}`);
            
            const zip = new AdmZip(zipPath);
            const zipEntries = zip.getEntries();
            
            zipEntries.forEach((entry) => {
                if (!entry.isDirectory) {
                    const entryPath = path.join(extractDir, entry.entryName);
                    
                    // Ensure directory exists
                    fs.ensureDirSync(path.dirname(entryPath));
                    
                    // Extract file
                    fs.writeFileSync(entryPath, entry.getData());
                }
            });

            console.log(`Extracted ${zipEntries.length} files from ${path.basename(zipPath)}`);
            return true;
        } catch (error) {
            console.error(`Error extracting ${zipPath}:`, error.message);
            return false;
        }
    }

    async processDatasheets(limit = 10) {
        console.log('\n=== Processing Datasheets ===');
        
        const files = await this.fetchDatasheetIndex();
        const limitedFiles = files.slice(0, limit); // Limit downloads for testing
        
        for (const file of limitedFiles) {
            const filePath = await this.downloadFile(file, this.datasheetDir);
            
            if (filePath && path.extname(filePath) === '.zip') {
                const extractPath = path.join(this.datasheetDir, 'extracted', path.basename(filePath, '.zip'));
                await fs.ensureDir(extractPath);
                await this.extractZipFile(filePath, extractPath);
            }
        }
    }

    async processShapefiles(limit = 5) {
        console.log('\n=== Processing Shapefiles ===');
        
        const files = await this.fetchShapefileIndex();
        const limitedFiles = files.slice(0, limit); // Limit downloads for testing
        
        for (const file of limitedFiles) {
            const filePath = await this.downloadFile(file, this.shapefileDir);
            
            if (filePath && path.extname(filePath) === '.zip') {
                const extractPath = path.join(this.shapefileDir, 'extracted', path.basename(filePath, '.zip'));
                await fs.ensureDir(extractPath);
                await this.extractZipFile(filePath, extractPath);
            }
        }
    }

    async generateInventory() {
        console.log('\n=== Generating Data Inventory ===');
        
        const inventory = {
            datasheets: [],
            shapefiles: [],
            generated: new Date().toISOString()
        };

        // Scan datasheet directory
        if (await fs.pathExists(this.datasheetDir)) {
            const datasheetFiles = await fs.readdir(this.datasheetDir, { withFileTypes: true });
            for (const file of datasheetFiles) {
                if (file.isFile()) {
                    const stats = await fs.stat(path.join(this.datasheetDir, file.name));
                    inventory.datasheets.push({
                        name: file.name,
                        size: stats.size,
                        modified: stats.mtime
                    });
                }
            }
        }

        // Scan shapefile directory
        if (await fs.pathExists(this.shapefileDir)) {
            const shapefileFiles = await fs.readdir(this.shapefileDir, { withFileTypes: true });
            for (const file of shapefileFiles) {
                if (file.isFile() && file.name.endsWith('.shp')) {
                    const stats = await fs.stat(path.join(this.shapefileDir, file.name));
                    inventory.shapefiles.push({
                        name: file.name,
                        size: stats.size,
                        modified: stats.mtime
                    });
                }
            }
        }

        const inventoryPath = path.join(this.processedDir, 'inventory.json');
        await fs.writeJson(inventoryPath, inventory, { spaces: 2 });
        
        console.log(`Data inventory saved to: ${inventoryPath}`);
        console.log(`Found ${inventory.datasheets.length} datasheets and ${inventory.shapefiles.length} shapefiles`);
        
        return inventory;
    }

    async run() {
        try {
            console.log('Starting NGS Data Fetcher...\n');
            
            await this.init();
            
            // Process a limited number of files for initial setup
            await this.processDatasheets(5); // Download first 5 datasheet files
            await this.processShapefiles(3); // Download first 3 shapefile archives
            
            await this.generateInventory();
            
            console.log('\nNGS Data Fetcher completed successfully!');
            
        } catch (error) {
            console.error('Error in NGS Data Fetcher:', error);
        }
    }
}

// Run if called directly
if (require.main === module) {
    const fetcher = new NGSDataFetcher();
    fetcher.run();
}

module.exports = NGSDataFetcher;