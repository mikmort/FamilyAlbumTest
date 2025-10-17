// Test script to verify blob lookup logic locally
// Run with: node scripts/test-blob-lookup.js

const { BlobServiceClient } = require('@azure/storage-blob');

const accountName = process.env.AZURE_STORAGE_ACCOUNT || 'famprodgajerhxssqswm';
const accountKey = process.env.AZURE_STORAGE_KEY || '';
const containerName = 'family-album-media';

async function blobExists(blobName) {
    const connectionString = `DefaultEndpointsProtocol=https;AccountName=${accountName};AccountKey=${accountKey};EndpointSuffix=core.windows.net`;
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    return await blockBlobClient.exists();
}

async function testBlobLookup(requestedPath) {
    console.log(`\n=== Testing: ${requestedPath} ===`);
    
    // Simulate what the API does
    let blobPath = requestedPath;
    
    console.log(`Trying blob path: "${blobPath}"`);
    
    // Try multiple variations
    const pathsToTry = [blobPath];
    
    const pathParts = blobPath.split('/');
    const directory = pathParts.slice(0, -1).join('/');
    const filenamePart = pathParts[pathParts.length - 1];
    
    console.log(`  Filename part: "${filenamePart}"`);
    
    // Add variation with spaces encoded only
    if (filenamePart.includes(' ') && !filenamePart.includes('%20')) {
        const spacesEncoded = directory + (directory ? '/' : '') + filenamePart.replace(/ /g, '%20');
        pathsToTry.push(spacesEncoded);
        console.log(`  Added spaces-only: "${spacesEncoded}"`);
    }
    
    // Add variation with full URL encoding (apostrophes AND spaces)
    // Note: encodeURIComponent doesn't encode apostrophes, so we do it manually
    const fullyEncoded = directory + (directory ? '/' : '') + 
        encodeURIComponent(filenamePart)
            .replace(/%2F/g, '/')
            .replace(/'/g, '%27');
    console.log(`  Full encoding would be: "${fullyEncoded}"`);
    if (fullyEncoded !== blobPath && !pathsToTry.includes(fullyEncoded)) {
        pathsToTry.push(fullyEncoded);
        console.log(`  Added fully-encoded: "${fullyEncoded}"`);
    }
    
    console.log(`  Total variations to try: ${pathsToTry.length}`);
    
    let blobFound = false;
    let foundPath = null;
    
    for (const tryPath of pathsToTry) {
        console.log(`  Checking: "${tryPath}"`);
        try {
            if (await blobExists(tryPath)) {
                blobFound = true;
                foundPath = tryPath;
                console.log(`  ✓ Found at: "${tryPath}"`);
                break;
            } else {
                console.log(`    Not found`);
            }
        } catch (err) {
            console.log(`    Error: ${err.message}`);
        }
    }
    
    if (!blobFound) {
        console.log(`  ✗ Blob not found with any variation`);
    }
    
    return { found: blobFound, path: foundPath };
}

async function main() {
    console.log('Testing blob lookup logic...\n');
    
    // Test cases based on actual URLs from the browser
    const testCases = [
        "Devorah's Wedding/PA130080.JPG",
        "Devorah's Wedding/Devorah's Wedding 010.jpg",
        "Devorah's Wedding/Devorah's Wedding 026.jpg",
        "Devorah's Wedding/PA130048.JPG",
    ];
    
    for (const testCase of testCases) {
        await testBlobLookup(testCase);
    }
    
    console.log('\n=== Summary ===');
    console.log('If any tests show "Not found", we need to adjust the lookup logic.');
}

main().catch(console.error);
