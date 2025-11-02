// Test the DELETE API endpoint
const https = require('https');

const SITE_URL = 'https://lively-glacier-02a77180f.2.azurestaticapps.net';
const filePath = 'Events/Thanksgiving/Thanksgiving 2013/IMG_5033.JPG';
const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
const url = `${SITE_URL}/api/media/${encodedPath}`;

console.log('Testing DELETE endpoint...');
console.log('URL:', url);
console.log('');

const options = {
    method: 'DELETE',
    headers: {
        'Content-Type': 'application/json'
    }
};

const req = https.request(url, options, (res) => {
    console.log('Status:', res.statusCode);
    console.log('Headers:', res.headers);
    console.log('');
    
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log('Response length:', data.length, 'bytes');
        console.log('');
        
        if (res.headers['content-type'] && res.headers['content-type'].includes('application/json')) {
            try {
                const json = JSON.parse(data);
                console.log('Response JSON:');
                console.log(JSON.stringify(json, null, 2));
            } catch (err) {
                console.log('Failed to parse JSON:', err.message);
                console.log('Raw response:');
                console.log(data.substring(0, 500));
            }
        } else {
            console.log('Non-JSON response:');
            console.log(data.substring(0, 500));
        }
    });
});

req.on('error', (err) => {
    console.error('Request error:', err.message);
});

req.end();
