// Check MOV and AVI files in the database
const https = require('https');

const SITE_URL = 'https://lively-glacier-02a77180f.2.azurestaticapps.net';

// Try with Adam Hodges (ID=2) 
const url = `${SITE_URL}/api/media?peopleIds=2`;

console.log('Checking video files...\n');

https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        if (res.statusCode !== 200) {
            console.log('Error:', res.statusCode);
            return;
        }
        
        const items = JSON.parse(data);
        
        const movFiles = items.filter(i => i.PFileName && i.PFileName.toLowerCase().endsWith('.mov'));
        const aviFiles = items.filter(i => i.PFileName && i.PFileName.toLowerCase().endsWith('.avi'));
        
        console.log('=== MOV FILES ===');
        console.log('Count:', movFiles.length);
        if (movFiles.length > 0) {
            const mov = movFiles[0];
            console.log('\nSample MOV:');
            console.log('  File:', mov.PFileName);
            console.log('  Type:', mov.PType);
            console.log('  BlobUrl:', mov.PBlobUrl ? 'exists' : 'NULL');
            console.log('  ThumbnailUrl:', mov.PThumbnailUrl ? 'exists' : 'NULL');
            console.log('  Thumb same as Blob?:', mov.PThumbnailUrl === mov.PBlobUrl);
            if (mov.PThumbnailUrl) {
                console.log('  Full Thumb URL:', mov.PThumbnailUrl);
            }
        }
        
        console.log('\n=== AVI FILES ===');
        console.log('Count:', aviFiles.length);
        if (aviFiles.length > 0) {
            const avi = aviFiles[0];
            console.log('\nSample AVI:');
            console.log('  File:', avi.PFileName);
            console.log('  Type:', avi.PType);
            console.log('  BlobUrl:', avi.PBlobUrl ? 'exists' : 'NULL');
            console.log('  ThumbnailUrl:', avi.PThumbnailUrl ? 'exists' : 'NULL');
            console.log('  Thumb same as Blob?:', avi.PThumbnailUrl === avi.PBlobUrl);
            if (avi.PThumbnailUrl) {
                console.log('  Full Thumb URL:', avi.PThumbnailUrl);
            }
        }
    });
}).on('error', err => console.error('Error:', err.message));
