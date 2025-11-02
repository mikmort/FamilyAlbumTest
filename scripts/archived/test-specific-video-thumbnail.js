// Test a specific video thumbnail URL
const https = require('https');

const videoPath = 'Events/Thanksgiving/Thanksgiving 2012/WP_20121123_007.mp4';
const encodedPath = encodeURIComponent(videoPath);
const url = `https://lively-glacier-02a77180f.2.azurestaticapps.net/api/media/${encodedPath}?thumbnail=true`;

console.log('🧪 Testing video thumbnail generation...');
console.log('📹 Video path:', videoPath);
console.log('🔗 URL:', url);
console.log('\nMaking request...\n');

const startTime = Date.now();

https.get(url, (res) => {
    const duration = Date.now() - startTime;
    
    console.log('⏱️  Response time:', duration + 'ms');
    console.log('📡 Status:', res.statusCode, res.statusMessage);
    console.log('📋 Headers:');
    Object.keys(res.headers).forEach(key => {
        console.log(`   ${key}: ${res.headers[key]}`);
    });
    console.log('');
    
    if (res.statusCode === 200) {
        console.log('✅ SUCCESS! Thumbnail was generated/retrieved');
        const contentType = res.headers['content-type'];
        const contentLength = res.headers['content-length'];
        
        if (contentType && contentType.includes('image')) {
            console.log(`📦 Image type: ${contentType}`);
            console.log(`📏 Size: ${contentLength} bytes`);
        } else {
            console.log('⚠️  WARNING: Response is not an image!');
            console.log(`   Content-Type: ${contentType}`);
        }
        
        res.destroy();
    } else if (res.statusCode === 404) {
        console.log('❌ 404 NOT FOUND - The video file or thumbnail could not be found');
        console.log('');
        console.log('Possible reasons:');
        console.log('  1. Video file does not exist in blob storage');
        console.log('  2. Thumbnail generation failed');
        console.log('  3. Path encoding issue');
        
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            if (data) {
                try {
                    const error = JSON.parse(data);
                    console.log('\n📄 Error response:', JSON.stringify(error, null, 2));
                } catch (e) {
                    console.log('\n📄 Response body:', data);
                }
            }
        });
    } else {
        console.log('❌ FAILED with status:', res.statusCode);
        
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try {
                const error = JSON.parse(data);
                console.log('\n📄 Error details:', JSON.stringify(error, null, 2));
            } catch (e) {
                console.log('\n📄 Response:', data);
            }
        });
    }
}).on('error', (err) => {
    console.error('❌ Request failed:', err.message);
    console.error(err.stack);
});
