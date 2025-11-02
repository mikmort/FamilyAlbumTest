// Check all MOV and AVI files - query database directly
const https = require('https');

const SITE_URL = 'https://lively-glacier-02a77180f.2.azurestaticapps.net';

async function checkVideos() {
    // Query for MOV files
    console.log('Searching for MOV files...\n');
    
    const movUrl = `${SITE_URL}/api/media/debug/namephoto-search?pattern=.mov`;
    
    return new Promise((resolve) => {
        https.get(movUrl, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    const result = JSON.parse(data);
                    console.log('MOV files in NamePhoto:', result.count);
                    if (result.rows && result.rows.length > 0) {
                        console.log('Sample MOV files:');
                        result.rows.slice(0, 5).forEach(r => {
                            console.log('  ', r.npFileName);
                        });
                    }
                }
                resolve();
            });
        });
    });
}

checkVideos();
