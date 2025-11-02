// Test to see exactly how blob names are stored
const { BlobServiceClient } = require('@azure/storage-blob');

const accountName = process.env.AZURE_STORAGE_ACCOUNT || 'famprodgajerhxssqswm';
const accountKey = process.env.AZURE_STORAGE_KEY || '';
const containerName = 'family-album-media';

async function listBlobs() {
    const connectionString = `DefaultEndpointsProtocol=https;AccountName=${accountName};AccountKey=${accountKey};EndpointSuffix=core.windows.net`;
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);

    console.log('Listing blobs in Devorah\'s Wedding folder:\n');
    
    const blobs = [];
    for await (const blob of containerClient.listBlobsFlat({ prefix: "Devorah's Wedding/" })) {
        blobs.push(blob.name);
    }
    
    // Show first 15
    console.log('First 15 blobs:');
    blobs.slice(0, 15).forEach(name => {
        console.log(`  "${name}"`);
    });
    
    console.log('\nLooking for specific files:');
    const testFiles = [
        "Devorah's Wedding/PA130048.JPG",
        "Devorah's Wedding/Devorah's Wedding 003.jpg",
        "Devorah's Wedding/Devorah%27s%20Wedding%20003.jpg",
        "Devorah's Wedding/Devorah's Wedding 033.mpg"
    ];
    
    for (const testFile of testFiles) {
        const found = blobs.includes(testFile);
        console.log(`  "${testFile}" - ${found ? 'EXISTS' : 'NOT FOUND'}`);
    }
}

listBlobs().catch(console.error);
