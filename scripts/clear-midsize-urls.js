// Clear broken/old midsize URLs from database
const sql = require('mssql');
const fs = require('fs');
const path = require('path');

// Load settings from local.settings.json
const settingsPath = path.join(__dirname, '..', 'api', 'local.settings.json');
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
const values = settings.Values || {};

const config = {
    server: values.AZURE_SQL_SERVER,
    database: values.AZURE_SQL_DATABASE,
    user: values.AZURE_SQL_USER,
    password: values.AZURE_SQL_PASSWORD,
    options: {
        encrypt: true,
        trustServerCertificate: false
    }
};

async function clearBrokenMidsizeUrls() {
    try {
        await sql.connect(config);
        console.log('Connected to database\n');

        // First, check current status
        console.log('=== CURRENT STATUS ===');
        const currentStatus = await sql.query`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN PMidsizeUrl IS NOT NULL AND PMidsizeUrl != '' THEN 1 ELSE 0 END) as withMidsize,
                SUM(CASE WHEN PMidsizeUrl IS NULL OR PMidsizeUrl = '' THEN 1 ELSE 0 END) as withoutMidsize
            FROM Pictures 
            WHERE PType = 1
        `;
        
        const stats = currentStatus.recordset[0];
        console.log(`Total images: ${stats.total}`);
        console.log(`With midsize URLs: ${stats.withMidsize}`);
        console.log(`Without midsize URLs: ${stats.withoutMidsize}\n`);

        // Clear all midsize URLs to force regeneration
        console.log('Clearing all existing midsize URLs...');
        const result = await sql.query`
            UPDATE Pictures 
            SET PMidsizeUrl = NULL 
            WHERE PType = 1 
            AND PMidsizeUrl IS NOT NULL
        `;

        console.log(`✓ Cleared ${result.rowsAffected[0]} midsize URLs\n`);

        // Verify the update
        console.log('=== UPDATED STATUS ===');
        const newStatus = await sql.query`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN PMidsizeUrl IS NOT NULL AND PMidsizeUrl != '' THEN 1 ELSE 0 END) as withMidsize,
                SUM(CASE WHEN PMidsizeUrl IS NULL OR PMidsizeUrl = '' THEN 1 ELSE 0 END) as needingMidsize
            FROM Pictures 
            WHERE PType = 1
        `;
        
        const newStats = newStatus.recordset[0];
        console.log(`Total images: ${newStats.total}`);
        console.log(`With midsize URLs: ${newStats.withMidsize}`);
        console.log(`Needing midsize generation: ${newStats.needingMidsize}`);
        console.log('\n✓ Ready for midsize regeneration!');
        console.log('\nNext steps:');
        console.log('1. Go to https://mortonfamilyalbum.com');
        console.log('2. Navigate to Settings → Admin Settings');
        console.log('3. Find "Midsize Image Generation" section');
        console.log('4. Click "Generate Midsize Images" and process in batches');

        await sql.close();
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

clearBrokenMidsizeUrls();
