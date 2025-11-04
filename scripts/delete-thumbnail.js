// Delete a thumbnail from Azure Blob Storage to force regeneration
const fs = require('fs');
const path = require('path');
const { BlobServiceClient } = require('@azure/storage-blob');

// Load environment variables from .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^\s*([^#][^=]*?)\s*=\s*(.*?)\s*$/);
        if (match) {
            process.env[match[1]] = match[2];
        }
    });
}

const fileName = process.argv[2];
if (!fileName) {
    console.error('Usage: node delete-thumbnail.js <filename>');
    process.exit(1);
}

const accountName = process.env.AZURE_STORAGE_ACCOUNT;
const accountKey = process.env.AZURE_STORAGE_KEY;
const containerName = process.env.AZURE_STORAGE_CONTAINER || 'family-album-media';

if (!accountName || !accountKey) {
    console.error('ERROR: AZURE_STORAGE_ACCOUNT and AZURE_STORAGE_KEY must be set in .env.local');
    process.exit(1);
}

async function deleteThumbnail() {
    try {
        // Construct thumbnail path
        const blobPath = fileName.startsWith('media/') ? fileName : `media/${fileName}`;
        const thumbnailPath = `thumbnails/${blobPath}`;
        
        console.log(`Thumbnail path: ${thumbnailPath}`);
        
        // Create blob service client
        const connectionString = `DefaultEndpointsProtocol=https;AccountName=${accountName};AccountKey=${accountKey};EndpointSuffix=core.windows.net`;
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const containerClient = blobServiceClient.getContainerClient(containerName);
        const blobClient = containerClient.getBlobClient(thumbnailPath);
        
        // Check if thumbnail exists
        const exists = await blobClient.exists();
        
        if (exists) {
            const properties = await blobClient.getProperties();
            console.log(`✓ Thumbnail found: ${thumbnailPath}`);
            console.log(`  Size: ${properties.contentLength} bytes`);
            console.log(`  Last Modified: ${properties.lastModified}`);
            
            // Delete thumbnail
            console.log('\nDeleting thumbnail...');
            await blobClient.delete();
            console.log('✓ Thumbnail deleted successfully!');
            console.log('\nThe thumbnail will be regenerated with correct orientation on next view.');
        } else {
            console.log(`✗ Thumbnail not found: ${thumbnailPath}`);
            console.log('  It may have already been deleted or never existed.');
        }
        
        console.log('\nDone!');
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

deleteThumbnail();
