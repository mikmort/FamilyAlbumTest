// Check video files for Judy Morton
const https = require('https');

const SITE_URL = 'https://lively-glacier-02a77180f.2.azurestaticapps.net';

// First, find Judy Morton's ID
console.log('Finding Judy Morton...\n');

https.get(`${SITE_URL}/api/people`, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        if (res.statusCode !== 200) {
            console.log('Error getting people:', res.statusCode);
            return;
        }
        
        const people = JSON.parse(data);
        const judy = people.find(p => p.neName === 'Judy Gail Morton');
        
        if (!judy) {
            console.log('Judy Gail Morton not found. Searching for similar names:');
            people.filter(p => p.neName && p.neName.toLowerCase().includes('judy')).forEach(p => {
                console.log(' -', p.neName, '(ID:', p.ID, ')');
            });
            return;
        }
        
        console.log('Found:', judy.neName, '(ID:', judy.ID, ')');
        console.log('');
        
        // Now get media for Judy
        https.get(`${SITE_URL}/api/media?peopleIds=${judy.ID}`, (res2) => {
            let data2 = '';
            res2.on('data', chunk => data2 += chunk);
            res2.on('end', () => {
                if (res2.statusCode !== 200) {
                    console.log('Error getting media:', res2.statusCode);
                    return;
                }
                
                const items = JSON.parse(data2);
                console.log('Total media items:', items.length);
                
                const movFiles = items.filter(i => i.PFileName && i.PFileName.toLowerCase().endsWith('.mov'));
                const aviFiles = items.filter(i => i.PFileName && i.PFileName.toLowerCase().endsWith('.avi'));
                
                console.log('\n=== MOV FILES ===');
                console.log('Count:', movFiles.length);
                if (movFiles.length > 0) {
                    console.log('\nFirst 3 MOV files:');
                    movFiles.slice(0, 3).forEach((mov, i) => {
                        console.log(`\n${i + 1}. ${mov.PFileName}`);
                        console.log('   BlobUrl:', mov.PBlobUrl ? mov.PBlobUrl : 'NULL');
                        console.log('   ThumbnailUrl:', mov.PThumbnailUrl ? mov.PThumbnailUrl : 'NULL');
                        console.log('   Thumb = Blob?:', mov.PThumbnailUrl === mov.PBlobUrl);
                    });
                }
                
                console.log('\n=== AVI FILES ===');
                console.log('Count:', aviFiles.length);
                if (aviFiles.length > 0) {
                    console.log('\nFirst 3 AVI files:');
                    aviFiles.slice(0, 3).forEach((avi, i) => {
                        console.log(`\n${i + 1}. ${avi.PFileName}`);
                        console.log('   BlobUrl:', avi.PBlobUrl ? avi.PBlobUrl : 'NULL');
                        console.log('   ThumbnailUrl:', avi.PThumbnailUrl ? avi.PThumbnailUrl : 'NULL');
                        console.log('   Thumb = Blob?:', avi.PThumbnailUrl === avi.PBlobUrl);
                    });
                }
            });
        });
    });
});
