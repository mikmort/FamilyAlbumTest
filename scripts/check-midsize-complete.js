// Check if all images have midsize versions generated
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

async function checkMidsizeStatus() {
    try {
        await sql.connect(config);
        console.log('Connected to database\n');

        // Get total image count
        const totalResult = await sql.query`
            SELECT COUNT(*) as total 
            FROM Pictures 
            WHERE PType = 1
        `;
        const totalImages = totalResult.recordset[0].total;

        // Get images with midsize URLs
        const midsizeResult = await sql.query`
            SELECT COUNT(*) as withMidsize 
            FROM Pictures 
            WHERE PType = 1 
            AND PMidsizeUrl IS NOT NULL 
            AND PMidsizeUrl != ''
        `;
        const imagesWithMidsize = midsizeResult.recordset[0].withMidsize;

        // Get images without midsize URLs
        const missingResult = await sql.query`
            SELECT COUNT(*) as missing 
            FROM Pictures 
            WHERE PType = 1 
            AND (PMidsizeUrl IS NULL OR PMidsizeUrl = '')
        `;
        const imagesMissing = missingResult.recordset[0].missing;

        // Get some examples of missing ones
        const examplesResult = await sql.query`
            SELECT TOP 10 PFileName, PWidth, PHeight, PYear 
            FROM Pictures 
            WHERE PType = 1 
            AND (PMidsizeUrl IS NULL OR PMidsizeUrl = '')
            ORDER BY PDateEntered DESC
        `;

        console.log('=== MIDSIZE IMAGE STATUS ===\n');
        console.log(`Total Images:              ${totalImages}`);
        console.log(`With Midsize URLs:         ${imagesWithMidsize}`);
        console.log(`Missing Midsize URLs:      ${imagesMissing}`);
        console.log(`Completion:                ${((imagesWithMidsize / totalImages) * 100).toFixed(2)}%\n`);

        if (imagesMissing > 0) {
            console.log('Sample of images missing midsize URLs:');
            console.log('─'.repeat(80));
            examplesResult.recordset.forEach(img => {
                console.log(`${img.PFileName} (${img.PWidth}x${img.PHeight}, ${img.PYear || 'unknown year'})`);
            });
        } else {
            console.log('✓ All images have midsize URLs!');
        }

        await sql.close();
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

checkMidsizeStatus();
