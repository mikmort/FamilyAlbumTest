// Check if video thumbnails exist in blob storage
const { BlobServiceClient } = require('@azure/storage-blob');

async function checkVideoThumbnails() {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    
    if (!connectionString) {
        console.error('❌ AZURE_STORAGE_CONNECTION_STRING not set');
        console.log('Set it with:');
        console.log('$env:AZURE_STORAGE_CONNECTION_STRING = "your-connection-string"');
        return;
    }

    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient('media');

    console.log('🔍 Checking for video files and their thumbnails...\n');

    let videoCount = 0;
    let thumbnailCount = 0;
    const videoExtensions = ['.mp4', '.mov', '.avi', '.wmv', '.mpg', '.mpeg', '.flv'];
    const videos = [];

    // First, find all video files
    for await (const blob of containerClient.listBlobsFlat()) {
        const ext = blob.name.toLowerCase().substring(blob.name.lastIndexOf('.'));
        if (videoExtensions.includes(ext)) {
            videoCount++;
            
            // Get just the filename for thumbnail check
            const fileName = blob.name.split('/').pop();
            const thumbnailPath = `thumbnails/${fileName}`;
            
            // Check if thumbnail exists
            const thumbnailClient = containerClient.getBlobClient(thumbnailPath);
            const thumbnailExists = await thumbnailClient.exists();
            
            if (thumbnailExists) {
                thumbnailCount++;
                console.log(`✅ ${blob.name}`);
                console.log(`   Thumbnail: ${thumbnailPath} (EXISTS)`);
            } else {
                console.log(`❌ ${blob.name}`);
                console.log(`   Thumbnail: ${thumbnailPath} (MISSING)`);
            }
            
            videos.push({
                video: blob.name,
                thumbnail: thumbnailPath,
                exists: thumbnailExists
            });
        }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Videos found: ${videoCount}`);
    console.log(`   Thumbnails found: ${thumbnailCount}`);
    console.log(`   Missing thumbnails: ${videoCount - thumbnailCount}`);
    
    if (thumbnailCount === 0 && videoCount > 0) {
        console.log('\n⚠️ NO THUMBNAILS FOUND! This suggests:');
        console.log('   1. FFmpeg is not running successfully in Azure Functions');
        console.log('   2. The thumbnail generation code is not being triggered');
        console.log('   3. Thumbnails are being saved to a different path');
    }
}

checkVideoThumbnails().catch(err => {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
});
