const sql = require('mssql');
const { BlobServiceClient } = require('@azure/storage-blob');

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

async function checkAndGetImages() {
    const pool = new sql.ConnectionPool(config);
    
    try {
        await pool.connect();
        
        const files = [
            'Events\\ES BnotMitzvah\\IMG_2583.JPG',
            'Family Pictures\\20181228_200909.jpg'
        ];
        
        console.log('=== Checking for image and thumbnail files in Azure Blob Storage ===\n');
        
        // Initialize blob service
        const blobServiceClient = BlobServiceClient.fromConnectionString(
            `DefaultEndpointsProtocol=https;AccountName=familyalbumprodstorageacctd4m3;AccountKey=${process.env.AZURE_STORAGE_ACCOUNT_KEY};EndpointSuffix=core.windows.net`
        );
        
        const containerClient = blobServiceClient.getContainerClient('photos');
        const thumbnailContainerClient = blobServiceClient.getContainerClient('thumbnails');
        
        for (const fileName of files) {
            console.log(`\n--- ${fileName} ---`);
            
            // Get database info
            const dbResult = await pool.request()
                .input('fileName', sql.NVarChar, fileName)
                .query(`
                    SELECT 
                        PFileName,
                        PBlobUrl,
                        PThumbnailUrl
                    FROM dbo.Pictures
                    WHERE PFileName = @fileName
                `);
            
            if (dbResult.recordset.length > 0) {
                const row = dbResult.recordset[0];
                console.log(`DB - Blob URL: ${row.PBlobUrl || '(none)'}`);
                console.log(`DB - Thumbnail URL: ${row.PThumbnailUrl || '(none)'}`);
            }
            
            // Try to find blobs
            try {
                // Check photos container
                const blobClient = containerClient.getBlockBlobClient(fileName);
                const exists = await blobClient.exists();
                console.log(`Photos container: ${exists ? 'EXISTS' : 'NOT FOUND'}`);
                if (exists) {
                    console.log(`  URL: ${blobClient.url}`);
                }
            } catch (e) {
                console.log(`Photos container: ERROR - ${e.message}`);
            }
            
            // Check thumbnails container
            try {
                const thumbBlobName = `${fileName}.jpg`;
                const thumbBlobClient = thumbnailContainerClient.getBlockBlobClient(thumbBlobName);
                const exists = await thumbBlobClient.exists();
                console.log(`Thumbnails container: ${exists ? 'EXISTS' : 'NOT FOUND'}`);
                if (exists) {
                    console.log(`  URL: ${thumbBlobClient.url}`);
                }
            } catch (e) {
                console.log(`Thumbnails container: ERROR - ${e.message}`);
            }
        }

    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    } finally {
        await pool.close();
    }
}

checkAndGetImages();
