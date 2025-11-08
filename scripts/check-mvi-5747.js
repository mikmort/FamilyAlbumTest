// Quick script to check how MVI_5747.mp4 is stored in the database
const { query } = require('../api/shared/db');

async function checkFile() {
    try {
        const result = await query(
            `SELECT PFileName, PFileDirectory, PBlobUrl, PThumbnailUrl, PType 
             FROM dbo.Pictures 
             WHERE PFileName LIKE '%MVI_5747%'`,
            {}
        );
        
        console.log('Found records:', result.length);
        result.forEach(r => {
            console.log('\n=== Record ===');
            console.log('PFileName:', r.PFileName);
            console.log('PFileDirectory:', r.PFileDirectory);
            console.log('PBlobUrl:', r.PBlobUrl);
            console.log('PThumbnailUrl:', r.PThumbnailUrl);
            console.log('PType:', r.PType);
        });
        
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

checkFile();
