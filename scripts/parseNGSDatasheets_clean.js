const fs = require('fs-extra');
const path = require('path');
const readline = require('readline');

class NGSDatasheetParser {
    constructor() {
        this.datasheetDir = path.join(__dirname, '..', 'data', 'datasheets');
        this.outputFile = path.join(__dirname, '..', 'data', 'processed', 'parsed_benchmarks.json');
        this.benchmarks = [];
    }

    async parseDatasheetFile(filePath, stateCode) {
        try {
            console.log(`Parsing ${stateCode} datasheets...`);
            
            const fileStream = fs.createReadStream(filePath);
            const rl = readline.createInterface({
                input: fileStream,
                crlfDelay: Infinity
            });

            let currentBenchmark = null;
            let benchmarkCount = 0;
            const maxBenchmarks = 5000; // Increased limit per state for full processing

            for await (const line of rl) {
                // Start new benchmark when we see a retrieval date line
                if (line.includes('National Geodetic Survey, Retrieval Date')) {
                    // Save previous benchmark if it has valid data
                    if (currentBenchmark && currentBenchmark.latitude && currentBenchmark.longitude && currentBenchmark.id) {
                        this.benchmarks.push(currentBenchmark);
                        benchmarkCount++;
                        
                        if (benchmarkCount === 1) {
                            console.log(`  First benchmark: ${currentBenchmark.id} at ${currentBenchmark.latitude}, ${currentBenchmark.longitude}`);
                        }
                        
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
                        description: null,
                        datasheet_url: `/data/datasheets/${stateCode}/${path.basename(filePath)}`
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
                    if (line.includes('POSITION-')) {
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

            // Save the last benchmark
            if (currentBenchmark && currentBenchmark.latitude && currentBenchmark.longitude && currentBenchmark.id) {
                this.benchmarks.push(currentBenchmark);
                benchmarkCount++;
            }

            console.log(`  -> Extracted ${benchmarkCount} benchmarks from ${stateCode}`);
            return benchmarkCount;
            
        } catch (error) {
            console.error(`Error parsing ${stateCode}:`, error.message);
            return 0;
        }
    }

    async processAllDatasheets() {
        console.log('Starting NGS datasheet processing for ALL states...\n');
        
        try {
            const stateFolders = await fs.readdir(this.datasheetDir);
            let totalBenchmarks = 0;
            let processedStates = 0;
            // Process ALL states - removed the limit
            
            for (const folder of stateFolders) {
                
                const folderPath = path.join(this.datasheetDir, folder);
                const stat = await fs.stat(folderPath);
                
                if (stat.isDirectory()) {
                    const txtFiles = await fs.readdir(folderPath);
                    const datasheetFile = txtFiles.find(file => file.endsWith('.txt'));
                    
                    if (datasheetFile) {
                        const filePath = path.join(folderPath, datasheetFile);
                        const count = await this.parseDatasheetFile(filePath, folder);
                        totalBenchmarks += count;
                        processedStates++;
                    }
                }
            }
            
            // Save results
            await this.saveResults();
            
            console.log('\nProcessing complete!');
            console.log(`Total benchmarks extracted: ${totalBenchmarks}`);
            console.log(`States processed: ${processedStates}`);
            
        } catch (error) {
            console.error('Error processing datasheets:', error);
        }
    }

    async saveResults() {
        try {
            // Ensure output directory exists
            await fs.ensureDir(path.dirname(this.outputFile));
            
            // Add descriptions to benchmarks
            this.benchmarks.forEach(benchmark => {
                if (!benchmark.description) {
                    benchmark.description = `NGS ${benchmark.type} control point in ${benchmark.state}`;
                }
            });
            
            // Save to JSON file
            await fs.writeJson(this.outputFile, this.benchmarks, { spaces: 2 });
            
            console.log(`\nBenchmark data saved to: ${this.outputFile}`);
            
            // Print statistics
            this.printStatistics();
            
        } catch (error) {
            console.error('Error saving results:', error);
        }
    }

    printStatistics() {
        const stats = {
            total: this.benchmarks.length,
            byType: {},
            byState: {}
        };
        
        this.benchmarks.forEach(benchmark => {
            // Count by type
            if (!stats.byType[benchmark.type]) {
                stats.byType[benchmark.type] = 0;
            }
            stats.byType[benchmark.type]++;
            
            // Count by state
            if (!stats.byState[benchmark.state]) {
                stats.byState[benchmark.state] = 0;
            }
            stats.byState[benchmark.state]++;
        });
        
        console.log('\n📊 Summary Statistics:');
        console.log(`Total benchmarks: ${stats.total}`);
        
        console.log('\nBy type:');
        Object.entries(stats.byType).forEach(([type, count]) => {
            console.log(`  ${type}: ${count}`);
        });
        
        console.log('\nBy state:');
        Object.entries(stats.byState).forEach(([state, count]) => {
            console.log(`  ${state}: ${count}`);
        });
    }
}

// Run the parser
async function main() {
    const parser = new NGSDatasheetParser();
    await parser.processAllDatasheets();
}

main().catch(console.error);