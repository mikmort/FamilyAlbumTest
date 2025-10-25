// Check what's actually stored in blob for video files
const https = require('https');
const fs = require('fs');

const SITE_URL = 'https://lemon-tree-0f8fd281e.5.azurestaticapps.net';

// The file path from your description
const testPath = 'Events/Thanksgiving/Thanksgiving 2012/MVI_5287.MOV';

async function checkFile() {
    const encodedPath = testPath.split('/').map(encodeURIComponent).join('/');
    const url = `${SITE_URL}/api/media/${encodedPath}`;
    
    console.log('Checking file:', testPath);
    console.log('URL:', url);
    
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            console.log('\n=== Response ===');
            console.log('Status:', res.statusCode);
            console.log('Content-Type:', res.headers['content-type']);
            console.log('Content-Length:', res.headers['content-length']);
            
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                console.log('Downloaded bytes:', buffer.length);
                
                // Check the file signature (magic bytes)
                if (buffer.length > 0) {
                    const first10 = buffer.slice(0, Math.min(10, buffer.length));
                    console.log('\nFirst 10 bytes (hex):', first10.toString('hex'));
                    console.log('First 10 bytes (ascii):', first10.toString('ascii'));
                    
                    // Check for common file signatures
                    const hex = first10.toString('hex');
                    if (hex.startsWith('ffd8ff')) {
                        console.log('✅ This is a valid JPEG file (starts with FFD8FF)');
                    } else if (hex.startsWith('89504e47')) {
                        console.log('⚠️ This is a PNG file, not JPG!');
                    } else if (hex.startsWith('424d')) {
                        console.log('⚠️ This is a BMP file, not JPG!');
                    } else if (hex.startsWith('0000001466747970') || hex.startsWith('00000018667479706d703432') || hex.startsWith('0000001c667479706d703432')) {
                        console.log('✅ This is a valid MOV/MP4 file (ftyp signature)');
                    } else if (hex.startsWith('1a45dfa3')) {
                        console.log('✅ This is a valid WebM/MKV file');
                    } else if (hex.startsWith('52494646')) {
                        console.log('✅ This is a valid AVI file (RIFF)');
                    } else if (hex.startsWith('3c21444f') || hex.startsWith('3c68746d') || hex.startsWith('3c48544d')) {
                        console.log('⚠️ This is HTML, not an image/video!');
                        console.log('\nHTML content:', buffer.toString('utf8').substring(0, 200));
                    } else if (hex.startsWith('7b')) {
                        console.log('⚠️ This is JSON, not an image/video!');
                        console.log('\nJSON content:', buffer.toString('utf8'));
                    } else {
                        console.log('❓ Unknown file format');
                        console.log('Trying to check if it might be a valid video with different signature...');
                        // Check a bit further in for ftyp
                        if (buffer.length > 20) {
                            const next20 = buffer.slice(0, 20).toString('hex');
                            console.log('First 20 bytes:', next20);
                            if (next20.includes('66747970')) {
                                console.log('✅ Found "ftyp" marker - this appears to be a valid video file');
                            }
                        }
                    }
                    
                    // Save to file for inspection
                    const filename = testPath.split('/').pop().replace(/\.[^.]+$/, '_downloaded.dat');
                    fs.writeFileSync(filename, buffer);
                    console.log(`\n💾 Saved to ${filename} for inspection`);
                } else {
                    console.log('❌ No data received');
                }
                
                resolve();
            });
        }).on('error', (err) => {
            console.error('❌ Error:', err.message);
            reject(err);
        });
    });
}

checkFile().catch(console.error);
