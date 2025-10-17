// List actual blob names from Azure Storage to see exact paths
const { getContainerClient } = require('../api/shared/storage');

// Load environment variables from api/local.settings.json
const localSettings = require('../api/local.settings.json');
Object.keys(localSettings.Values).forEach(key => {
    process.env[key] = localSettings.Values[key];
});

async function listDevorahBlobs() {
    try {
        const containerClient = getContainerClient();
        
        console.log('\n=== Blobs containing "Devorah" ===\n');
        
        let count = 0;
        for await (const blob of containerClient.listBlobsFlat()) {
            if (blob.name.toLowerCase().includes('devorah')) {
                console.log(`Blob name: "${blob.name}"`);
                count++;
                if (count >= 10) {
                    console.log('... (showing first 10)');
                    break;
                }
            }
        }
        
        if (count === 0) {
            console.log('No blobs found containing "Devorah"');
            console.log('\nListing first 20 blobs in container:');
            count = 0;
            for await (const blob of containerClient.listBlobsFlat()) {
                console.log(`  "${blob.name}"`);
                count++;
                if (count >= 20) break;
            }
        }
        
    } catch (err) {
        console.error('Error:', err.message);
        console.error('\nMake sure api/local.settings.json has correct Azure Storage credentials');
    }
}

listDevorahBlobs();
