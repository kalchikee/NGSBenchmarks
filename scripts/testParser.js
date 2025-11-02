const fs = require('fs-extra');
const path = require('path');
const readline = require('readline');

class NGSDatasheetParser {
    constructor() {
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
            let lineCount = 0;

            for await (const line of rl) {
                lineCount++;
                
                // Start new benchmark when we see a retrieval date line
                if (line.includes('National Geodetic Survey, Retrieval Date')) {
                    // Save previous benchmark if it has coordinates
                    if (currentBenchmark && currentBenchmark.latitude && currentBenchmark.longitude) {
                        this.benchmarks.push(currentBenchmark);
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
                    if (line.includes('POSITION-') && line.includes('N)') && line.includes('W)')) {
                        const coordMatch = line.match(/(\d+)\s+(\d+)\s+([\d.]+)\(N\)\s+(\d+)\s+(\d+)\s+([\d.]+)\(W\)/);
                        if (coordMatch) {
                            const latDeg = parseInt(coordMatch[1]);
                            const latMin = parseInt(coordMatch[2]);
                            const latSec = parseFloat(coordMatch[3]);
                            const lonDeg = parseInt(coordMatch[4]);
                            const lonMin = parseInt(coordMatch[5]);
                            const lonSec = parseFloat(coordMatch[6]);

                            currentBenchmark.latitude = latDeg + (latMin / 60) + (latSec / 3600);
                            currentBenchmark.longitude = -(lonDeg + (lonMin / 60) + (lonSec / 3600));
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
                }

                // Stop after processing some lines for testing
                if (lineCount > 10000) break;
            }

            // Don't forget the last benchmark
            if (currentBenchmark && currentBenchmark.latitude && currentBenchmark.longitude) {
                this.benchmarks.push(currentBenchmark);
            }

            console.log(`  -> Extracted ${this.benchmarks.filter(b => b.state === stateCode).length} benchmarks from ${stateCode}`);
            
            return this.benchmarks;
        } catch (error) {
            console.error(`Error parsing ${stateCode}:`, error);
            return [];
        }
    }
}

async function main() {
    console.log('Starting NGS datasheet processing (line-by-line test)...\n');
    
    const parser = new NGSDatasheetParser();
    
    // Test with just one state file
    const testFile = path.join(__dirname, '..', 'data', 'datasheets', 'AK', 'AK.txt');
    
    if (fs.existsSync(testFile)) {
        await parser.parseDatasheetFile(testFile, 'AK');
        
        if (parser.benchmarks.length > 0) {
            console.log('\n📊 First few benchmarks found:');
            parser.benchmarks.slice(0, 3).forEach(b => {
                console.log(`  ${b.id}: ${b.latitude}, ${b.longitude} (${b.elevation}m) - ${b.name}`);
            });
        }
        
        console.log(`\nTotal benchmarks extracted: ${parser.benchmarks.length}`);
    } else {
        console.log('Test file not found:', testFile);
    }
}

main().catch(console.error);