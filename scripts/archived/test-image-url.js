// Quick test to check if the specific image loads from the API
const https = require('https');

const testUrls = [
    // The image you're trying to view
    "https://lively-glacier-02a77180f.2.azurestaticapps.net/api/media/Devorah's%20Wedding%5CPA120032.JPG",
    // With forward slash
    "https://lively-glacier-02a77180f.2.azurestaticapps.net/api/media/Devorah's%20Wedding%2FPA120032.JPG",
    // Try other similar files
    "https://lively-glacier-02a77180f.2.azurestaticapps.net/api/media/Devorah's%20Wedding/PA130132.JPG",
];

console.log('Testing image URLs...\n');

testUrls.forEach(url => {
    https.get(url, (res) => {
        const status = res.statusCode;
        const contentType = res.headers['content-type'];
        
        if (status === 200) {
            console.log(`✓ SUCCESS: ${url}`);
            console.log(`  Status: ${status}`);
            console.log(`  Content-Type: ${contentType}`);
        } else {
            console.log(`✗ FAILED: ${url}`);
            console.log(`  Status: ${status}`);
            
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    console.log(`  Error: ${json.error || JSON.stringify(json)}`);
                } catch {
                    console.log(`  Response: ${data.substring(0, 100)}`);
                }
            });
        }
        console.log('');
    }).on('error', (e) => {
        console.log(`✗ ERROR: ${url}`);
        console.log(`  ${e.message}\n`);
    });
});

setTimeout(() => {}, 5000); // Keep script alive for responses
