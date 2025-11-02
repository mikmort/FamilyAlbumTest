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

async function getThumbnails() {
    const pool = new sql.ConnectionPool(config);
    
    try {
        await pool.connect();
        
        const files = [
            'Events\\ES BnotMitzvah\\IMG_2583.JPG',
            'Family Pictures\\20181228_200909.jpg'
        ];
        
        console.log('=== Thumbnail URLs for the 2 inconsistent files ===\n');
        
        for (const fileName of files) {
            const result = await pool.request()
                .input('fileName', sql.NVarChar, fileName)
                .query(`
                    SELECT 
                        PFileName,
                        PBlobUrl,
                        PThumbnailUrl,
                        PType,
                        PPeopleList
                    FROM dbo.Pictures
                    WHERE PFileName = @fileName
                `);
            
            if (result.recordset.length > 0) {
                const row = result.recordset[0];
                console.log(`File: ${row.PFileName}`);
                console.log(`PPeopleList: ${row.PPeopleList}`);
                console.log(`Type: ${row.PType === 1 ? 'Image' : 'Video'}`);
                console.log(`Blob URL: ${row.PBlobUrl || '(none)'}`);
                console.log(`Stored Thumbnail URL: ${row.PThumbnailUrl || '(none)'}`);
                
                // Construct thumbnail URL if not stored
                if (!row.PThumbnailUrl) {
                    const thumbUrl = `https://familyalbum-prod-storage.blob.core.windows.net/thumbnails/${encodeURIComponent(row.PFileName)}.jpg`;
                    console.log(`Expected Thumbnail URL: ${thumbUrl}`);
                }
                console.log();
            }
        }

    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    } finally {
        await pool.close();
    }
}

getThumbnails();
