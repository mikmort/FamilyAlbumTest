// Script to list blobs in Azure storage
const { getContainerClient } = require('../api/shared/storage');

// Load environment variables from api/local.settings.json
const localSettings = require('../api/local.settings.json');
Object.keys(localSettings.Values).forEach(key => {
    process.env[key] = localSettings.Values[key];
});

async function listBlobs() {
    try {
        const containerClient = getContainerClient();
        
        console.log('\n=== Listing blobs matching "Devorah" ===\n');
        
        let count = 0;
        for await (const blob of containerClient.listBlobsFlat()) {
            if (blob.name.toLowerCase().includes('devorah')) {
                console.log(`Blob: ${blob.name}`);
                count++;
            }
        }
        
        console.log(`\nFound ${count} blobs matching "Devorah"`);
        
        console.log('\n=== Listing blobs matching "Wedding" ===\n');
        
        count = 0;
        for await (const blob of containerClient.listBlobsFlat()) {
            if (blob.name.toLowerCase().includes('wedding')) {
                console.log(`Blob: ${blob.name}`);
                count++;
                if (count > 20) {
                    console.log('... (truncated, showing first 20)');
                    break;
                }
            }
        }
        
    } catch (err) {
        console.error('Error:', err.message);
    }
}

listBlobs();
