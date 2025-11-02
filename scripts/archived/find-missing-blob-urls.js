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

async function findMissingBlobUrls() {
    const pool = new sql.ConnectionPool(config);
    
    try {
        await pool.connect();
        
        console.log('=== Pictures in table WITHOUT PBlobUrl (likely not uploaded) ===\n');
        
        // Get pictures without blob URLs
        const result = await pool.request()
            .query(`
                SELECT 
                    PFileName,
                    PType,
                    PBlobUrl,
                    COUNT(*) OVER () as TotalMissing
                FROM dbo.Pictures
                WHERE PBlobUrl IS NULL
                ORDER BY PFileName
            `);
        
        const totalMissing = result.recordset.length > 0 ? result.recordset[0].TotalMissing : 0;
        
        console.log(`Total pictures WITHOUT PBlobUrl: ${totalMissing}\n`);
        
        // Show first 30
        console.log('First 30 files without blob URLs:\n');
        
        result.recordset.slice(0, 30).forEach((row, idx) => {
            const typeStr = row.PType === 1 ? 'IMG' : 'VID';
            console.log(`${idx + 1}. [${typeStr}] ${row.PFileName}`);
        });
        
        if (totalMissing > 30) {
            console.log(`\n... and ${totalMissing - 30} more\n`);
        }
        
        // Check the specific 2 files
        console.log(`\n=== Checking the 2 specific problematic files ===\n`);
        
        const specificFiles = [
            'Events\\ES BnotMitzvah\\IMG_2583.JPG',
            'Family Pictures\\20181228_200909.jpg'
        ];
        
        for (const fileName of specificFiles) {
            const checkResult = await pool.request()
                .input('fileName', sql.NVarChar, fileName)
                .query(`
                    SELECT PFileName, PType, PBlobUrl, PPeopleList
                    FROM dbo.Pictures
                    WHERE PFileName = @fileName
                `);
            
            if (checkResult.recordset.length > 0) {
                const row = checkResult.recordset[0];
                console.log(`${fileName}`);
                console.log(`  PBlobUrl: ${row.PBlobUrl || '(NULL - NOT IN BLOB STORAGE)'}`);
                console.log(`  PPeopleList: ${row.PPeopleList}`);
                console.log();
            } else {
                console.log(`${fileName} - NOT FOUND IN DATABASE`);
                console.log();
            }
        }
        
        // Summary stats
        console.log('\n=== Summary Statistics ===\n');
        
        const stats = await pool.request()
            .query(`
                SELECT 
                    COUNT(*) as TotalPictures,
                    SUM(CASE WHEN PBlobUrl IS NOT NULL THEN 1 ELSE 0 END) as WithBlobUrl,
                    SUM(CASE WHEN PBlobUrl IS NULL THEN 1 ELSE 0 END) as WithoutBlobUrl
                FROM dbo.Pictures
            `);
        
        const row = stats.recordset[0];
        console.log(`Total pictures: ${row.TotalPictures}`);
        console.log(`With blob URL: ${row.WithBlobUrl}`);
        console.log(`WITHOUT blob URL: ${row.WithoutBlobUrl}`);
        console.log(`Percentage missing: ${((row.WithoutBlobUrl / row.TotalPictures) * 100).toFixed(2)}%`);

    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    } finally {
        await pool.close();
    }
}

findMissingBlobUrls();
