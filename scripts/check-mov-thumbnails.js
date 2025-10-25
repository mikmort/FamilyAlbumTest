// Check MOV files and their thumbnails
const https = require('https');

const SITE_URL = 'https://lemon-tree-0f8fd281e.5.azurestaticapps.net';

// Try with Adam Hodges (ID=2)
const url = `${SITE_URL}/api/media?peopleIds=2`;

console.log('Fetching media with peopleIds=2...');
console.log('URL:', url);

https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        
        if (res.statusCode !== 200) {
            console.log('Response:', data.substring(0, 500));
            return;
        }
        
        try {
            const items = JSON.parse(data);
            console.log('Total items:', items.length);
            
            const movFiles = items.filter(item => 
                item.PFileName && item.PFileName.toLowerCase().endsWith('.mov')
            );
            
            console.log('MOV files found:', movFiles.length);
            console.log('');
            
            movFiles.forEach((mov, index) => {
                console.log(`\n=== MOV File #${index + 1} ===`);
                console.log('Filename:', mov.PFileName);
                console.log('Type:', mov.PType);
                console.log('Has BlobUrl:', !!mov.PBlobUrl);
                console.log('Has ThumbnailUrl:', !!mov.PThumbnailUrl);
                
                if (mov.PThumbnailUrl) {
                    console.log('Thumbnail URL:', mov.PThumbnailUrl);
                    
                    // Check if thumbnail URL is same as blob URL (fallback)
                    if (mov.PThumbnailUrl === mov.PBlobUrl) {
                        console.log('⚠️ Thumbnail URL is same as Blob URL (no separate thumbnail)');
                    }
                    
                    // Check if thumbnail starts with "thumb_"
                    const thumbName = mov.PThumbnailUrl.split('/').pop();
                    if (thumbName && thumbName.startsWith('thumb_')) {
                        console.log('✅ Has dedicated thumbnail file:', thumbName);
                    } else {
                        console.log('⚠️ No "thumb_" prefix - might be using main video as thumbnail');
                    }
                } else {
                    console.log('❌ No thumbnail URL in database');
                }
            });
            
        } catch (err) {
            console.error('Parse error:', err.message);
        }
    });
}).on('error', (err) => {
    console.error('Request error:', err.message);
});
