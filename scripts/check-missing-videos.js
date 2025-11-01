const { query } = require('../api/shared/db');

const failingFiles = [
    'MVI_0191.MOV',
    'MVI_0057.MOV',
    'MVI_0080.MOV',
    'MVI_5287.MOV',
    'MVI_0055.MOV',
    'MVI_0048.MOV',
    'MVI_0079.MOV',
    'P8240098.MOV',
    'P2210046.MOV',
    'P6190122.MP4',
    'P7270013.MP4',
    'P7270007.MP4',
    'P2210044.MOV',
    'scn032.jpg',
    'grandkids.jpg'
];

async function checkFiles() {
    try {
        console.log('Checking database for failing files\n');
        
        for (const filename of failingFiles) {
            const result = await query(
                `SELECT PFileName, PFileDirectory, PBlobUrl
                FROM Pictures 
                WHERE PFileName LIKE @filename`,
                { filename: '%' + filename }
            );
            
            if (result.length === 0) {
                console.log(`❌ ${filename} - NOT FOUND in database`);
            } else {
                for (const row of result) {
                    console.log(`\n📁 ${filename}:`);
                    console.log(`   PFileName: ${row.PFileName}`);
                    console.log(`   PFileDirectory: ${row.PFileDirectory}`);
                    console.log(`   PBlobUrl: ${row.PBlobUrl}`);
                    
                    // Construct the path that the API would use
                    let apiPath = row.PFileName;
                    if (row.PFileDirectory && row.PFileDirectory.trim() !== '') {
                        apiPath = row.PFileDirectory + '/' + row.PFileName;
                    }
                    apiPath = apiPath.replace(/\\/g, '/').replace(/\/\//g, '/');
                    console.log(`   🔧 API would construct: ${apiPath}`);
                }
            }
        }
        
    } catch (err) {
        console.error('Error:', err.message);
    }
}

checkFiles();
