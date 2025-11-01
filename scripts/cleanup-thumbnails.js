/**
 * Delete tiny placeholder thumbnails so they regenerate with new video files
 */

const { BlobServiceClient } = require('@azure/storage-blob');

const storageAccount = 'famprodgajerhxssqswm';
const containerName = 'family-album-media';
const storageKey = process.env.AZURE_STORAGE_KEY;

if (!storageKey) {
  console.error('❌ AZURE_STORAGE_KEY environment variable not set');
  process.exit(1);
}

const blobServiceClient = new BlobServiceClient(
  `https://${storageAccount}.blob.core.windows.net`,
  new (require('@azure/storage-blob').StorageSharedKeyCredential)(storageAccount, storageKey)
);

const containerClient = blobServiceClient.getContainerClient(containerName);

async function cleanupPlaceholders() {
  try {
    console.log('='.repeat(80));
    console.log('Cleanup Placeholder Thumbnails');
    console.log('='.repeat(80));
    console.log('');
    console.log('🔍 Finding placeholder thumbnails to delete...');
    console.log('');
    
    let totalChecked = 0;
    let placeholdersFound = 0;
    let deleted = 0;
    const errors = [];
    
    // List all blobs in the thumbnails/ prefix
    const thumbnailsPrefix = 'thumbnails/';
    
    for await (const blob of containerClient.listBlobsFlat({ prefix: thumbnailsPrefix })) {
      totalChecked++;
      
      if (totalChecked % 50 === 0) {
        process.stdout.write(`   Checked ${totalChecked} thumbnails...\r`);
      }
      
      // Check if blob is very small (< 100 bytes = likely a placeholder)
      if (blob.properties.contentLength < 100) {
        placeholdersFound++;
        console.log(`\n🗑️  Deleting tiny placeholder (${blob.properties.contentLength} bytes): ${blob.name}`);
        
        try {
          const blobClient = containerClient.getBlobClient(blob.name);
          await blobClient.delete();
          deleted++;
          console.log(`   ✅ Deleted`);
        } catch (deleteError) {
          console.log(`   ❌ Error: ${deleteError.message}`);
          errors.push({ file: blob.name, error: deleteError.message });
        }
      }
    }
    
    console.log(`\n   Checked ${totalChecked} thumbnails total`);
    console.log('');
    console.log('='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total thumbnails checked: ${totalChecked}`);
    console.log(`Placeholders found:       ${placeholdersFound}`);
    console.log(`Successfully deleted:     ${deleted}`);
    console.log(`Errors:                   ${errors.length}`);
    console.log('='.repeat(80));
    console.log('');
    
    if (errors.length > 0) {
      console.log('Failed deletions:');
      errors.forEach(({ file, error }) => {
        console.log(`  ❌ ${file}`);
        console.log(`     ${error}`);
      });
      console.log('');
    }
    
    if (deleted > 0) {
      console.log('✅ Cleanup complete!');
      console.log('');
      console.log('These thumbnails will be regenerated automatically when:');
      console.log('• Users view the gallery');
      console.log('• The thumbnail generation function runs');
      console.log('• Videos are accessed in the browser');
      console.log('');
      console.log('The new thumbnails will either be:');
      console.log('• Real video thumbnails (extracted from MP4 files)');
      console.log('• Nice SVG placeholders (if extraction fails)');
    } else {
      console.log('ℹ️  No placeholders found to delete.');
    }
    
  } catch (err) {
    console.error('');
    console.error('❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

cleanupPlaceholders();
