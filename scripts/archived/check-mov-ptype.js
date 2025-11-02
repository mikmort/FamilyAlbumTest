const sql = require('mssql');
const fs = require('fs');
const path = require('path');

// Load database config
const configPath = path.join(__dirname, '..', 'api', 'local.settings.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8')).Values;

const dbConfig = {
    server: config.AZURE_SQL_SERVER,
    database: config.AZURE_SQL_DATABASE,
    user: config.AZURE_SQL_USER,
    password: config.AZURE_SQL_PASSWORD,
    options: {
        encrypt: true,
        trustServerCertificate: false
    }
};

async function checkMOVFiles() {
    try {
        await sql.connect(dbConfig);
        
        // Check specific file
        console.log('\n=== Checking MVI_5304 ===');
        const specific = await sql.query`
            SELECT PFileName, PType, PThumbnailUrl, PFileDirectory, PTime
            FROM Pictures 
            WHERE PFileName LIKE '%MVI_5304%'
        `;
        console.log(JSON.stringify(specific.recordset, null, 2));
        
        // Check all MOV files
        console.log('\n=== All MOV files in database ===');
        const allMov = await sql.query`
            SELECT PFileName, PType, PThumbnailUrl, PTime
            FROM Pictures 
            WHERE PFileName LIKE '%.MOV' OR PFileName LIKE '%.mov'
            ORDER BY PFileName
        `;
        console.log(`Found ${allMov.recordset.length} MOV files`);
        console.log(JSON.stringify(allMov.recordset, null, 2));
        
        await sql.close();
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

checkMOVFiles();
