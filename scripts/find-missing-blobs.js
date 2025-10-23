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

async function findMissingBlobs() {
    const pool = new sql.ConnectionPool(config);
    
    try {
        await pool.connect();
        
        console.log('=== Finding Pictures table entries NOT in blob storage ===\n');
        
        // Get all pictures from database
        const dbResult = await pool.request()
            .query(`
                SELECT PFileName, PType, PBlobUrl
                FROM dbo.Pictures
                ORDER BY PFileName
            `);
        
        console.log(`Total pictures in database: ${dbResult.recordset.length}\n`);
        
        // Initialize blob service
        const connectionString = `DefaultEndpointsProtocol=https;AccountName=familyalbumprodstorageacctd4m3;AccountKey=${process.env.AZURE_STORAGE_ACCOUNT_KEY};EndpointSuffix=core.windows.net`;
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const containerClient = blobServiceClient.getContainerClient('photos');
        
        // Get all blobs from storage
        const blobsInStorage = new Set();
        const blobIterator = containerClient.listBlobsFlat();
        
        for await (const blob of blobIterator) {
            blobsInStorage.add(blob.name);
        }
        
        console.log(`Total blobs in storage: ${blobsInStorage.size}\n`);
        
        // Find mismatches
        const missingInBlob = [];
        const haveBlobUrl = [];
        const noBlobUrl = [];
        
        for (const picture of dbResult.recordset) {
            if (!blobsInStorage.has(picture.PFileName)) {
                missingInBlob.push(picture);
                
                if (picture.PBlobUrl) {
                    haveBlobUrl.push(picture);
                } else {
                    noBlobUrl.push(picture);
                }
            }
        }
        
        console.log(`=== RESULTS ===\n`);
        console.log(`Pictures NOT in blob storage: ${missingInBlob.length}`);
        console.log(`  - Have PBlobUrl stored: ${haveBlobUrl.length}`);
        console.log(`  - No PBlobUrl stored: ${noBlobUrl.length}\n`);
        
        // Show the ones with no blob URL (most concerning)
        console.log(`=== Top 20 pictures NOT in blob storage (no PBlobUrl) ===\n`);
        
        noBlobUrl.slice(0, 20).forEach((pic, idx) => {
            console.log(`${idx + 1}. ${pic.PFileName}`);
        });
        
        if (noBlobUrl.length > 20) {
            console.log(`\n... and ${noBlobUrl.length - 20} more\n`);
        }
        
        // Check the specific 2 files
        console.log(`\n=== Checking the 2 specific files ===\n`);
        const file1 = 'Events\\ES BnotMitzvah\\IMG_2583.JPG';
        const file2 = 'Family Pictures\\20181228_200909.jpg';
        
        console.log(`"${file1}": ${blobsInStorage.has(file1) ? 'IN STORAGE' : 'NOT IN STORAGE'}`);
        console.log(`"${file2}": ${blobsInStorage.has(file2) ? 'IN STORAGE' : 'NOT IN STORAGE'}`);

    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    } finally {
        await pool.close();
    }
}

findMissingBlobs();
