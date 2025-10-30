const { BlobServiceClient } = require('@azure/storage-blob');

module.exports = async function (context, req) {
  // Optional: check for admin authentication here
  const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const CONTAINER_NAME = 'family-album-media'; // Replace with your actual container name

  const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
  const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);

  let renamed = 0;
  for await (const blob of containerClient.listBlobsFlat()) {
    if (blob.name.includes('\\')) {
      const newName = blob.name.replace(/\\/g, '/');
      const blockBlobClient = containerClient.getBlockBlobClient(blob.name);
      const downloadResponse = await blockBlobClient.download();
      const buffer = await streamToBuffer(downloadResponse.readableStreamBody);

      const newBlobClient = containerClient.getBlockBlobClient(newName);
      await newBlobClient.uploadData(buffer, {
        blobHTTPHeaders: { blobContentType: blob.properties.contentType }
      });
      await blockBlobClient.delete();
      renamed++;
    }
  }

  context.res = {
    status: 200,
    body: { success: true, renamed }
  };
};

async function streamToBuffer(readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on('data', (data) => {
      chunks.push(data instanceof Buffer ? data : Buffer.from(data));
    });
    readableStream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    readableStream.on('error', reject);
  });
}
