const fs = require('fs-extra');
const path = require('path');
const readline = require('readline');

async function debugParser() {
    const testFile = path.join(__dirname, '..', 'data', 'datasheets', 'AK', 'AK.txt');
    
    if (!fs.existsSync(testFile)) {
        console.log('Test file not found:', testFile);
        return;
    }
    
    console.log('File exists, starting debug parse...');
    
    const fileStream = fs.createReadStream(testFile);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let lineCount = 0;
    let retrievalCount = 0;
    let pidCount = 0;
    let positionCount = 0;

    for await (const line of rl) {
        lineCount++;
        
        if (line.includes('National Geodetic Survey, Retrieval Date')) {
            retrievalCount++;
            if (retrievalCount <= 3) {
                console.log(`Retrieval line ${retrievalCount}: ${line}`);
            }
        }
        
        if (line.includes('PID') && line.includes('-')) {
            pidCount++;
            if (pidCount <= 3) {
                console.log(`PID line ${pidCount}: ${line}`);
            }
        }
        
        if (line.includes('POSITION-')) {
            positionCount++;
            if (positionCount <= 3) {
                console.log(`Position line ${positionCount}: ${line}`);
            }
        }
        
        if (lineCount > 50000) break; // Limit for testing
    }
    
    console.log(`\nStats from first ${lineCount} lines:`);
    console.log(`- Retrieval date lines: ${retrievalCount}`);
    console.log(`- PID lines: ${pidCount}`);
    console.log(`- Position lines: ${positionCount}`);
}

debugParser().catch(console.error);