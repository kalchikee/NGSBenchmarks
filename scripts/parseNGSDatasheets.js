const fs = require('fs-extra');
const path = require('path');
const readline = require('readline');

class NGSDatasheetParser {
    constructor() {
        this.datasheetDir = path.join(__dirname, '..', 'data', 'datasheets');
        this.outputFile = path.join(__dirname, '..', 'data', 'processed', 'parsed_benchmarks.json');
        this.benchmarks = [];
    }

    // Parse a single NGS datasheet entry
    parseDatasheetEntry(text) {
        const lines = text.split('\n');
        const benchmark = {
            id: null,
            name: null,
            type: 'horizontal', // default
            latitude: null,
            longitude: null,
            elevation: null,
            accuracy: null,
            date_established: null,
            description: null,
            state: null,
            condition: null,
            setting: null,
            county: null
        };

        let currentPID = null;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Parse PID from lines like " DB0629  PID         -  DB0629"
            if (line.includes('PID') && line.includes('-')) {
                const match = line.match(/([A-Z0-9]{6})\s+PID\s+-\s+([A-Z0-9]+)/);
                if (match) {
                    benchmark.id = match[2];
                    currentPID = match[1];
                }
            }

            // Parse designation from lines like " DB0629  DESIGNATION -  -59 Y"
            if (line.includes('DESIGNATION') && line.includes('-')) {
                const match = line.match(/DESIGNATION\s+-\s+(.+)/);
                if (match) {
                    benchmark.name = match[1].trim();
                }
            }

            // Parse state/county from lines like " DB0629  STATE/COUNTY-  CA/IMPERIAL"
            if (line.includes('STATE/COUNTY') && line.includes('-')) {
                const match = line.match(/STATE\/COUNTY-\s+([A-Z]{2})\/(.+)/);
                if (match) {
                    benchmark.state = match[1];
                    benchmark.county = match[2].trim();
                }
            }

            // Parse NAD 83 coordinates - look for various formats
            if (line.includes('NAD 83') && line.includes('POSITION')) {
                // Format: "NAD 83(2011) POSITION- 61 57 42.22481(N) 162 56 16.72477(W) ADJUSTED"
                const coordMatch = line.match(/POSITION-\s*(\d+)\s+(\d+)\s+([\d.]+)\([NS]\)\s+(\d+)\s+(\d+)\s+([\d.]+)\([EW]\)/);
                if (coordMatch) {
                    const latDeg = parseInt(coordMatch[1]);
                    const latMin = parseInt(coordMatch[2]);
                    const latSec = parseFloat(coordMatch[3]);
                    const lonDeg = parseInt(coordMatch[4]);
                    const lonMin = parseInt(coordMatch[5]);
                    const lonSec = parseFloat(coordMatch[6]);

                    let latitude = latDeg + (latMin / 60) + (latSec / 3600);
                    let longitude = lonDeg + (lonMin / 60) + (lonSec / 3600);
                    
                    // Check for hemisphere indicators
                    const hemisphereMatch = line.match(/(\d+)\s+(\d+)\s+([\d.]+)\(([NS])\)\s+(\d+)\s+(\d+)\s+([\d.]+)\(([EW])\)/);
                    if (hemisphereMatch) {
                        if (hemisphereMatch[4] === 'S') latitude = -latitude;
                        if (hemisphereMatch[8] === 'W') longitude = -longitude;
                    }
                    
                    benchmark.latitude = latitude;
                    benchmark.longitude = longitude;
                }
            }

            // Parse elevation - try multiple formats
            if (line.includes('ELLIP HT') || line.includes('ORTHO HEIGHT')) {
                // Format: "NAD 83(2011) ELLIP HT- 152.910 (meters)" or "NAVD 88 ORTHO HEIGHT - 143.82 (meters)"
                const elevMatch = line.match(/(?:ELLIP HT-|ORTHO HEIGHT\s*-)\s*([-\d.]+)\s*\(meters\)/);
                if (elevMatch) {
                    benchmark.elevation = parseFloat(elevMatch[1]);
                }
            }

            // Parse condition
            if (line.includes('CONDITION') && line.includes('-')) {
                const condMatch = line.match(/CONDITION\s*-\s*(.+)/);
                if (condMatch) {
                    benchmark.condition = condMatch[1].trim();
                }
            }

            // Parse setting/monument description
            if (line.includes('SETTING') && line.includes('-')) {
                const settingMatch = line.match(/SETTING\s*-\s*(.+)/);
                if (settingMatch) {
                    benchmark.setting = settingMatch[1].trim();
                }
            }

            // Parse survey date from history
            if (line.includes('HISTORY') || line.includes('SURVEY')) {
                const dateMatch = line.match(/(\d{4})/);
                if (dateMatch) {
                    benchmark.date_established = dateMatch[1];
                }
            }

            // Determine benchmark type based on data type indicators
            if (line.includes('VERTICAL CONTROL') || line.includes('NAVD 88')) {
                benchmark.type = 'vertical';
            } else if (line.includes('CORS') || line.includes('CONTINUOUSLY OPERATING')) {
                benchmark.type = 'cors';
            } else if (line.includes('GRAVITY')) {
                benchmark.type = 'gravity';
            } else if (line.includes('TRIANGULATION')) {
                benchmark.type = 'triangulation';
            }
        }

        // Generate description if we have location info
        if (benchmark.county && benchmark.state) {
            benchmark.description = `NGS ${benchmark.type} control point in ${benchmark.county} County, ${benchmark.state}`;
        }

        // Only return benchmarks with valid coordinates and ID
        if (benchmark.latitude && benchmark.longitude && benchmark.id) {
            return benchmark;
        }
        return null;
    }

    // Parse a datasheet file and extract all benchmarks using line-by-line processing
    async parseDatasheetFile(filePath, stateCode) {
        try {
            console.log(`Parsing ${stateCode} datasheets...`);
            
            const fileStream = fs.createReadStream(filePath);
            const rl = readline.createInterface({
                input: fileStream,
                crlfDelay: Infinity
            });

            let currentBenchmark = null;
            let lineCount = 0;
            let benchmarkCount = 0;
            const maxBenchmarks = 1000; // Limit per state for performance

            for await (const line of rl) {
                lineCount++;
                
                // Start new benchmark when we see a retrieval date line
                if (line.includes('National Geodetic Survey, Retrieval Date')) {
                    // Save previous benchmark if it has valid coordinates
                    if (currentBenchmark && currentBenchmark.latitude && currentBenchmark.longitude && currentBenchmark.id) {
                        currentBenchmark.description = currentBenchmark.description || `NGS ${currentBenchmark.type} control point in ${stateCode}`;
                        currentBenchmark.datasheet_url = `/data/datasheets/${stateCode}/${path.basename(filePath)}`;
                        this.benchmarks.push(currentBenchmark);
                        benchmarkCount++;
                        
                        if (benchmarkCount >= maxBenchmarks) break;
                    }
                    
                    // Start new benchmark
                    currentBenchmark = {
                        id: null,
                        name: null,
                        type: 'Control Point',
                        latitude: null,
                        longitude: null,
                        elevation: null,
                        state: stateCode,
                        description: null
                    };
                }

                if (currentBenchmark) {
                    // Parse PID
                    if (line.includes('PID') && line.includes('-')) {
                        const pidMatch = line.match(/PID\s*-\s*([A-Z0-9]+)/);
                        if (pidMatch) {
                            currentBenchmark.id = pidMatch[1];
                        }
                    }

                    // Parse coordinates
                    if (line.includes('POSITION-') && (line.includes('N)') || line.includes('S)')) && (line.includes('W)') || line.includes('E)'))) {
                        const coordMatch = line.match(/(\d+)\s+(\d+)\s+([\d.]+)\(([NS])\)\s+(\d+)\s+(\d+)\s+([\d.]+)\(([EW])\)/);
                        if (coordMatch) {
                            const latDeg = parseInt(coordMatch[1]);
                            const latMin = parseInt(coordMatch[2]);
                            const latSec = parseFloat(coordMatch[3]);
                            const latHem = coordMatch[4];
                            const lonDeg = parseInt(coordMatch[5]);
                            const lonMin = parseInt(coordMatch[6]);
                            const lonSec = parseFloat(coordMatch[7]);
                            const lonHem = coordMatch[8];

                            let latitude = latDeg + (latMin / 60) + (latSec / 3600);
                            let longitude = lonDeg + (lonMin / 60) + (lonSec / 3600);
                            
                            if (latHem === 'S') latitude = -latitude;
                            if (lonHem === 'W') longitude = -longitude;

                            currentBenchmark.latitude = latitude;
                            currentBenchmark.longitude = longitude;
                        }
                    }

                    // Parse elevation
                    if (line.includes('ELLIP HT-') || line.includes('ORTHO HEIGHT')) {
                        const elevMatch = line.match(/(?:ELLIP HT-|ORTHO HEIGHT\s*-)\s*([\d.-]+)\s*\(meters\)/);
                        if (elevMatch) {
                            currentBenchmark.elevation = parseFloat(elevMatch[1]);
                        }
                    }

                    // Parse designation for name
                    if (line.includes('DESIGNATION') && line.includes('-')) {
                        const nameMatch = line.match(/DESIGNATION\s*-\s*(.+)/);
                        if (nameMatch) {
                            currentBenchmark.name = nameMatch[1].trim();
                        }
                    }

                    // Determine type based on content
                    if (line.includes('PACS')) {
                        currentBenchmark.type = 'Primary Airport Control';
                    } else if (line.includes('CORS')) {
                        currentBenchmark.type = 'CORS Station';
                    } else if (line.includes('TRIANGULATION')) {
                        currentBenchmark.type = 'Triangulation Station';
                    } else if (line.includes('VERTICAL')) {
                        currentBenchmark.type = 'Vertical Control';
                    }
                }
            }

            // Don't forget the last benchmark
            if (currentBenchmark && currentBenchmark.latitude && currentBenchmark.longitude && currentBenchmark.id) {
                currentBenchmark.description = currentBenchmark.description || `NGS ${currentBenchmark.type} control point in ${stateCode}`;
                currentBenchmark.datasheet_url = `/data/datasheets/${stateCode}/${path.basename(filePath)}`;
                this.benchmarks.push(currentBenchmark);
                benchmarkCount++;
            }

            console.log(`  -> Extracted ${benchmarkCount} benchmarks from ${stateCode}`);
            return benchmarkCount;
            
        } catch (error) {
            console.error(`Error parsing ${filePath}:`, error.message);
            return 0;
        }
    }

    // Process all datasheet files
    async processAllDatasheets() {
        console.log('Starting NGS datasheet processing...\n');
        
        try {
            const stateFolders = await fs.readdir(this.datasheetDir);
            let totalBenchmarks = 0;
            let processedStates = 0;
            const maxStates = 10; // Limit to first 10 states for demo
            
            for (const folder of stateFolders) {
                if (processedStates >= maxStates) break;
                
                const folderPath = path.join(this.datasheetDir, folder);
                const stat = await fs.stat(folderPath);
                
                if (stat.isDirectory() && folder.length <= 3 && folder !== 'Zips') {
                    const files = await fs.readdir(folderPath);
                    
                    for (const file of files) {
                        if (file.endsWith('.txt') || file.endsWith('.dat')) {
                            const filePath = path.join(folderPath, file);
                            const count = await this.parseDatasheetFile(filePath, folder);
                            totalBenchmarks += count;
                            break; // Only process first file per state for demo
                        }
                    }
                    processedStates++;
                }
            }
            
            console.log(`\nProcessing complete!`);
            console.log(`Total benchmarks extracted: ${totalBenchmarks}`);
            console.log(`States processed: ${processedStates}`);
            
            // Save results
            await this.saveBenchmarks();
            
            return this.benchmarks;
            
        } catch (error) {
            console.error('Error processing datasheets:', error);
            return [];
        }
    }

    // Save parsed benchmarks to JSON file
    async saveBenchmarks() {
        try {
            await fs.ensureDir(path.dirname(this.outputFile));
            await fs.writeJson(this.outputFile, {
                benchmarks: this.benchmarks,
                count: this.benchmarks.length,
                generated: new Date().toISOString(),
                source: 'NGS datasheets'
            }, { spaces: 2 });
            
            console.log(`\nBenchmark data saved to: ${this.outputFile}`);
            
        } catch (error) {
            console.error('Error saving benchmarks:', error);
        }
    }

    // Get summary statistics
    getSummary() {
        const summary = {
            total: this.benchmarks.length,
            byType: {},
            byState: {}
        };

        this.benchmarks.forEach(benchmark => {
            // Count by type
            summary.byType[benchmark.type] = (summary.byType[benchmark.type] || 0) + 1;
            
            // Count by state
            summary.byState[benchmark.state] = (summary.byState[benchmark.state] || 0) + 1;
        });

        return summary;
    }
}

// Run the parser if called directly
async function main() {
    const parser = new NGSDatasheetParser();
    
    try {
        const benchmarks = await parser.processAllDatasheets();
        const summary = parser.getSummary();
        
        console.log('\n📊 Summary Statistics:');
        console.log(`Total benchmarks: ${summary.total}`);
        console.log('\nBy type:');
        Object.entries(summary.byType).forEach(([type, count]) => {
            console.log(`  ${type}: ${count}`);
        });
        console.log('\nBy state:');
        Object.entries(summary.byState).forEach(([state, count]) => {
            console.log(`  ${state}: ${count}`);
        });
        
    } catch (error) {
        console.error('Parser failed:', error);
    }
}

if (require.main === module) {
    main();
}

module.exports = NGSDatasheetParser;