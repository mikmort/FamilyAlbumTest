const { BlobServiceClient } = require('@azure/storage-blob');
const config = require('../api/local.settings.json').Values;

async function checkBlob() {
  try {
    const connectionString = `DefaultEndpointsProtocol=https;AccountName=${config.AZURE_STORAGE_ACCOUNT};AccountKey=${config.AZURE_STORAGE_KEY};EndpointSuffix=core.windows.net`;
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(config.AZURE_STORAGE_CONTAINER);

    const blobName = 'Events/ES BnotMitzvah/MVI_5732.mp4';
    const blobClient = containerClient.getBlobClient(blobName);
    
    console.log(`\n🔍 Checking blob: ${blobName}`);
    
    const exists = await blobClient.exists();
    console.log(`   Exists: ${exists ? '✅ YES' : '❌ NO'}`);
    
    if (exists) {
      const properties = await blobClient.getProperties();
      console.log(`   Size: ${(properties.contentLength / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Content-Type: ${properties.contentType}`);
      console.log(`   Last Modified: ${properties.lastModified}`);
    }
    
    console.log();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkBlob();
