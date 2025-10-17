// Check if filenames in database are URL-encoded
const { query } = require('../api/shared/db');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

async function checkFilenames() {
    try {
        // Query for the specific Devorah's Wedding file
        const result = await query(`
            SELECT TOP 5 
                PFileName, 
                PFileDirectory,
                LEN(PFileName) as FileNameLength,
                LEN(PFileDirectory) as DirLength
            FROM dbo.Pictures 
            WHERE PFileName LIKE '%PA130100%'
            OR PFileDirectory LIKE '%Devorah%'
        `);
        
        console.log('\n=== Files matching Devorah/PA130100 ===\n');
        result.forEach(row => {
            console.log(`Directory: "${row.PFileDirectory}" (length: ${row.DirLength})`);
            console.log(`Filename:  "${row.PFileName}" (length: ${row.FileNameLength})`);
            console.log(`Has %27: ${row.PFileDirectory?.includes('%27') || row.PFileName?.includes('%27')}`);
            console.log(`Has %20: ${row.PFileDirectory?.includes('%20') || row.PFileName?.includes('%20')}`);
            console.log('---');
        });
        
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

checkFilenames();
