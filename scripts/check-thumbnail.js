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

async function checkThumbnail() {
    const pool = new sql.ConnectionPool(config);
    
    try {
        await pool.connect();
        
        const fileName = 'On Location\\Florida Dec 2009\\IMG_7919.JPG';
        
        console.log(`=== Checking thumbnail for: ${fileName} ===\n`);
        
        const result = await pool.request()
            .input('fileName', sql.NVarChar, fileName)
            .query(`
                SELECT 
                    PFileName,
                    PType,
                    PBlobUrl,
                    PThumbnailUrl,
                    PDescription,
                    PYear,
                    PMonth
                FROM dbo.Pictures
                WHERE PFileName = @fileName
            `);
        
        if (result.recordset.length === 0) {
            console.log(`❌ File not found in database`);
            return;
        }
        
        const pic = result.recordset[0];
        console.log(`File: ${pic.PFileName}`);
        console.log(`Type: ${pic.PType === 1 ? 'Image' : 'Video'}`);
        console.log(`Date: ${pic.PMonth ? pic.PMonth + '/' : '?/'}${pic.PYear || '?'}`);
        console.log(`Description: ${pic.PDescription || '(none)'}`);
        console.log();
        console.log(`Blob URL: ${pic.PBlobUrl || '(none)'}`);
        console.log(`Stored Thumbnail URL: ${pic.PThumbnailUrl || '(none)'}`);
        console.log();
        
        // Show the thumbnail URL that would be generated on-demand
        const generatedThumbUrl = `/api/media/${encodeURIComponent(pic.PFileName)}?thumbnail=true`;
        console.log(`On-demand Thumbnail URL: ${generatedThumbUrl}`);
        console.log();
        
        // Check if there are any duplicate files with similar names
        const duplicateResult = await pool.request()
            .query(`
                SELECT PFileName
                FROM dbo.Pictures
                WHERE PFileName LIKE '%IMG_7919%'
                ORDER BY PFileName
            `);
        
        if (duplicateResult.recordset.length > 1) {
            console.log(`⚠️  Found ${duplicateResult.recordset.length} files with similar name:\n`);
            duplicateResult.recordset.forEach(row => {
                console.log(`  - ${row.PFileName}`);
            });
        }

    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    } finally {
        await pool.close();
    }
}

checkThumbnail();
