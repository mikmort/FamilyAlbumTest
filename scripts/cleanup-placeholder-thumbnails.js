// Delete tiny placeholder thumbnails (< 100 bytes) so they get regenerated with better SVG placeholders
const { getContainerClient, deleteBlob } = require('../api/shared/storage');

async function cleanupPlaceholders() {
    try {
        console.log('Finding placeholder thumbnails to regenerate...\n');
        
        const containerClient = getContainerClient();
        let totalChecked = 0;
        let placeholdersFound = 0;
        let deleted = 0;
        
        // List all blobs in the thumbnails/ prefix
        const thumbnailsPrefix = 'thumbnails/';
        
        for await (const blob of containerClient.listBlobsFlat({ prefix: thumbnailsPrefix })) {
            totalChecked++;
            
            if (totalChecked % 100 === 0) {
                console.log(`Checked ${totalChecked} thumbnails...`);
            }
            
            // Check if blob is very small (< 100 bytes = likely a placeholder)
            if (blob.properties.contentLength < 100) {
                placeholdersFound++;
                console.log(`🔍 Found tiny placeholder (${blob.properties.contentLength} bytes): ${blob.name}`);
                
                try {
                    await deleteBlob(blob.name);
                    deleted++;
                    console.log(`   ✅ Deleted - will regenerate on next request`);
                } catch (deleteError) {
                    console.log(`   ❌ Error deleting: ${deleteError.message}`);
                }
            }
        }
        
        console.log(`\n${'='.repeat(80)}`);
        console.log('SUMMARY');
        console.log('='.repeat(80));
        console.log(`Total thumbnails checked: ${totalChecked}`);
        console.log(`Placeholders found:       ${placeholdersFound}`);
        console.log(`Successfully deleted:     ${deleted}`);
        console.log('='.repeat(80));
        console.log(`\nThese thumbnails will be regenerated with the new SVG placeholder`);
        console.log(`the next time they are requested.\n`);
        
    } catch (err) {
        console.error('Error:', err.message);
        console.error(err.stack);
        process.exit(1);
    }
}

cleanupPlaceholders();
