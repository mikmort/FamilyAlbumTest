// Upload missing media files from E:\Family Album to Azure Blob Storage
// This script properly handles special characters in filenames

const { BlobServiceClient } = require('@azure/storage-blob');
const fs = require('fs');
const path = require('path');

const STORAGE_ACCOUNT = 'famprodgajerhxssqswm';
const CONTAINER_NAME = 'family-album-media';
const STORAGE_KEY = process.env.AZURE_STORAGE_KEY;
const LOCAL_BASE_PATH = 'E:\\Family Album';

// Media file extensions
const MEDIA_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif',
  '.mp4', '.mov', '.avi', '.mpg', '.mpeg', '.wmv', '.m4v', '.3gp'
];

async function getAllBlobs(containerClient) {
  console.log('📥 Getting list of files in blob storage...');
  const blobSet = new Set();
  
  for await (const blob of containerClient.listBlobsFlat()) {
    blobSet.add(blob.name.toLowerCase());
  }
  
  console.log(`   Found ${blobSet.size} files in blob storage\n`);
  return blobSet;
}

function getAllLocalFiles(dir, baseDir = dir) {
  let files = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      files = files.concat(getAllLocalFiles(fullPath, baseDir));
    } else {
      const ext = path.extname(item.name).toLowerCase();
      if (MEDIA_EXTENSIONS.includes(ext)) {
        const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
        files.push({
          localPath: fullPath,
          blobPath: relativePath,
          size: fs.statSync(fullPath).size
        });
      }
    }
  }
  return files;
}

async function uploadFile(containerClient, file, index, total) {
  const percent = ((index / total) * 100).toFixed(1);
  process.stdout.write(`[${index}/${total} - ${percent}%] Uploading: ${file.blobPath}`);
  
  try {
    const blockBlobClient = containerClient.getBlockBlobClient(file.blobPath);
    await blockBlobClient.uploadFile(file.localPath);
    console.log(' ✅');
    return { success: true };
  } catch (error) {
    console.log(' ❌');
    console.log(`   Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  if (!STORAGE_KEY) {
    console.error('❌ AZURE_STORAGE_KEY environment variable not set');
    process.exit(1);
  }
  
  console.log('='.repeat(80));
  console.log('Upload Missing Media Files');
  console.log('='.repeat(80));
  console.log(`Source: ${LOCAL_BASE_PATH}`);
  console.log(`Target: ${STORAGE_ACCOUNT}/${CONTAINER_NAME}`);
  console.log('='.repeat(80));
  console.log('');
  
  // Create blob service client
  const { StorageSharedKeyCredential } = require('@azure/storage-blob');
  const sharedKeyCredential = new StorageSharedKeyCredential(STORAGE_ACCOUNT, STORAGE_KEY);
  const blobServiceClient = new BlobServiceClient(
    `https://${STORAGE_ACCOUNT}.blob.core.windows.net`,
    sharedKeyCredential
  );
  const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
  
  // Get existing blobs
  const blobSet = await getAllBlobs(containerClient);
  
  // Get local files
  console.log('📁 Scanning local files...');
  const localFiles = getAllLocalFiles(LOCAL_BASE_PATH);
  console.log(`   Found ${localFiles.length} media files (filtered)\n`);
  
  // Find missing files
  console.log('🔍 Checking for missing files...');
  const missingFiles = localFiles.filter(f => !blobSet.has(f.blobPath.toLowerCase()));
  console.log(`   Found ${missingFiles.length} missing files\n`);
  
  if (missingFiles.length === 0) {
    console.log('✅ No missing files found!');
    return;
  }
  
  // Show summary
  const totalSize = missingFiles.reduce((sum, f) => sum + f.size, 0);
  console.log(`📤 Uploading ${missingFiles.length} files (${(totalSize / 1024 / 1024).toFixed(2)} MB)...\n`);
  
  // Upload files
  const startTime = Date.now();
  let uploaded = 0;
  let failed = 0;
  
  for (let i = 0; i < missingFiles.length; i++) {
    const result = await uploadFile(containerClient, missingFiles[i], i + 1, missingFiles.length);
    if (result.success) {
      uploaded++;
    } else {
      failed++;
    }
  }
  
  const duration = (Date.now() - startTime) / 1000 / 60;
  
  console.log('');
  console.log('='.repeat(80));
  console.log('UPLOAD SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total files:    ${missingFiles.length}`);
  console.log(`Uploaded:       ${uploaded}`);
  console.log(`Failed:         ${failed}`);
  console.log(`Total size:     ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Time elapsed:   ${duration.toFixed(1)} minutes`);
  console.log(`Average speed:  ${((totalSize / 1024 / 1024) / duration).toFixed(2)} MB/min`);
  console.log('='.repeat(80));
  
  if (failed === 0) {
    console.log('\n✅ Upload complete!');
  } else {
    console.log(`\n⚠️  Upload completed with ${failed} errors`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
