// This script will trigger thumbnail generation for files that don't have thumbnails
// by making API calls to the media endpoint with ?thumbnail=true

const https = require('https');

// Your deployed site URL
const SITE_URL = 'https://lemon-tree-0f8fd281e.5.azurestaticapps.net';

async function fetchAPI(path) {
    return new Promise((resolve, reject) => {
        https.get(`${SITE_URL}${path}`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve({ raw: data, status: res.statusCode });
                }
            });
        }).on('error', reject);
    });
}

async function generateMissingThumbnails() {
    try {
        console.log('Fetching all media files...');
        
        // Get all media - we'll filter for person ID=1 (assuming Adam Hodges)
        const response = await fetchAPI('/api/media?peopleIds=1');
        
        if (!response.success) {
            console.error('Failed to fetch media:', response);
            return;
        }
        
        console.log(`Found ${response.mediaItems.length} media items`);
        
        // Filter for items without thumbnails or MOV files
        const needsThumbnails = response.mediaItems.filter(item => 
            !item.PThumbnailUrl || 
            item.PFileName.toLowerCase().endsWith('.mov') ||
            item.PFileName.includes('IMG_5033')
        );
        
        console.log(`\nFound ${needsThumbnails.length} items that need thumbnails:`);
        
        for (const item of needsThumbnails.slice(0, 10)) { // Limit to first 10 for testing
            console.log(`\nProcessing: ${item.PFileName}`);
            console.log(`  Current thumbnail: ${item.PThumbnailUrl || 'NONE'}`);
            console.log(`  Type: ${item.PType === 2 ? 'VIDEO' : 'IMAGE'}`);
            
            // Construct the thumbnail URL
            const fileName = item.PFileName.replace(/\\/g, '/');
            const encodedPath = fileName.split('/').map(encodeURIComponent).join('/');
            const thumbUrl = `/api/media/${encodedPath}?thumbnail=true`;
            
            console.log(`  Requesting: ${thumbUrl}`);
            
            try {
                const result = await fetchAPI(thumbUrl);
                if (result.status === 200) {
                    console.log(`  ✅ Thumbnail generated/retrieved successfully`);
                } else {
                    console.log(`  ❌ Failed: Status ${result.status}`);
                }
            } catch (err) {
                console.log(`  ❌ Error: ${err.message}`);
            }
            
            // Wait a bit between requests
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        console.log('\n✅ Done');
        
    } catch (err) {
        console.error('❌ Error:', err);
    }
}

generateMissingThumbnails();
