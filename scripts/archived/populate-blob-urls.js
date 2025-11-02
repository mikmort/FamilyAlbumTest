const sql = require('mssql');

const config = {
    server: process.env.AZURE_SQL_SERVER,
    authentication: {
        type: 'default',
        options: {
            userName: process.env.AZURE_SQL_USER,
            password: process.env.AZURE_SQL_PASSWORD
        }
    },
    options: {
        encrypt: true,
        trustServerCertificate: false,
        connectTimeout: 15000
    },
    database: 'FamilyAlbum'
};

async function populateBlobUrls() {
    const pool = new sql.ConnectionPool(config);
    
    try {
        await pool.connect();
        
        console.log('=== Populating PBlobUrl for all pictures ===\n');
        
        // First, check current state
        const beforeResult = await pool.request()
            .query(`
                SELECT 
                    COUNT(*) as Total,
                    SUM(CASE WHEN PBlobUrl IS NOT NULL THEN 1 ELSE 0 END) as WithUrl,
                    SUM(CASE WHEN PBlobUrl IS NULL THEN 1 ELSE 0 END) as WithoutUrl
                FROM dbo.Pictures
            `);
        
        const before = beforeResult.recordset[0];
        console.log(`Before update:`);
        console.log(`  Total: ${before.Total}`);
        console.log(`  With PBlobUrl: ${before.WithUrl}`);
        console.log(`  Without PBlobUrl: ${before.WithoutUrl}\n`);
        
        // Update PBlobUrl for all pictures
        const updateResult = await pool.request()
            .query(`
                UPDATE dbo.Pictures
                SET PBlobUrl = 'https://familyalbumprodstorageacctd4m3.blob.core.windows.net/photos/' + 
                               REPLACE(REPLACE(PFileName, '\\', '%5C'), ' ', '%20')
                WHERE PBlobUrl IS NULL
            `);
        
        console.log(`Updated ${updateResult.rowsAffected[0]} pictures with blob URLs\n`);
        
        // Verify update
        const afterResult = await pool.request()
            .query(`
                SELECT 
                    COUNT(*) as Total,
                    SUM(CASE WHEN PBlobUrl IS NOT NULL THEN 1 ELSE 0 END) as WithUrl,
                    SUM(CASE WHEN PBlobUrl IS NULL THEN 1 ELSE 0 END) as WithoutUrl
                FROM dbo.Pictures
            `);
        
        const after = afterResult.recordset[0];
        console.log(`After update:`);
        console.log(`  Total: ${after.Total}`);
        console.log(`  With PBlobUrl: ${after.WithUrl}`);
        console.log(`  Without PBlobUrl: ${after.WithoutUrl}\n`);
        
        // Show sample URLs
        console.log('Sample URLs created:\n');
        const samples = await pool.request()
            .query(`
                SELECT TOP 5
                    PFileName,
                    PBlobUrl
                FROM dbo.Pictures
                WHERE PBlobUrl IS NOT NULL
                ORDER BY PFileName
            `);
        
        samples.recordset.forEach((row, idx) => {
            console.log(`${idx + 1}. File: ${row.PFileName}`);
            console.log(`   URL: ${row.PBlobUrl}\n`);
        });
        
        console.log('✓ Successfully populated PBlobUrl for all pictures!\n');

    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    } finally {
        await pool.close();
    }
}

populateBlobUrls();
