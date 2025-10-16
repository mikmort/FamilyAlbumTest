// Quick script to check database paths
const path = require('path');
const { query } = require('../api/shared/db');

// Load environment variables from api/local.settings.json
const localSettings = require('../api/local.settings.json');
Object.keys(localSettings.Values).forEach(key => {
    process.env[key] = localSettings.Values[key];
});

async function checkPaths() {
    try {
        // Check Devorah's Wedding files
        const result = await query(`
            SELECT TOP 5 PFileName, PFileDirectory 
            FROM dbo.Pictures 
            WHERE PFileName LIKE '%PA130%'
            ORDER BY PFileName
        `);
        
        console.log('\n=== Database Records (Devorah\'s Wedding files) ===');
        result.forEach(row => {
            console.log(`PFileDirectory: "${row.PFileDirectory || ''}"`);
            console.log(`PFileName: "${row.PFileName || ''}"`);
            const combined = row.PFileDirectory ? `${row.PFileDirectory}/${row.PFileName}` : row.PFileName;
            const normalized = combined.replace(/\\/g, '/').replace(/\/+/g, '/');
            console.log(`Combined & normalized: "${normalized}"`);
            console.log('---');
        });
        
    } catch (err) {
        console.error('Error:', err);
    }
}

checkPaths();

