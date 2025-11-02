// Test video thumbnail generation via API
const https = require('https');

// Replace with your actual video file path from the database
const testVideoPath = 'EDIT_THIS/test.avi'; // Update this!

const url = `https://familyalbumtest.azurewebsites.net/api/media/${encodeURIComponent(testVideoPath)}?thumbnail=true`;

console.log('🧪 Testing video thumbnail generation...');
console.log('📹 Video path:', testVideoPath);
console.log('🔗 Request URL:', url);
console.log('\nMaking request...\n');

https.get(url, (res) => {
    console.log('📡 Response Status:', res.statusCode);
    console.log('📋 Response Headers:', res.headers);
    
    if (res.statusCode === 200) {
        console.log('✅ SUCCESS! Thumbnail generated/retrieved');
        console.log('📦 Content-Type:', res.headers['content-type']);
        console.log('📏 Content-Length:', res.headers['content-length']);
        
        // Don't download the actual image, just verify it worked
        res.destroy();
    } else {
        console.log('❌ FAILED! Status:', res.statusCode);
        
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try {
                const error = JSON.parse(data);
                console.log('Error details:', error);
            } catch (e) {
                console.log('Response:', data);
            }
        });
    }
}).on('error', (err) => {
    console.error('❌ Request failed:', err.message);
});

console.log('\n💡 To use this script:');
console.log('1. Find a video file path from your database');
console.log('2. Edit this script and replace testVideoPath with the actual path');
console.log('3. Run: node scripts/test-video-thumbnail-api.js');
