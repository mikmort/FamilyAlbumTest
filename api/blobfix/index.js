const { BlobServiceClient } = require('@azure/storage-blob');

module.exports = async function (context, req) {
  const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const CONTAINER_NAME = process.env.AZURE_STORAGE_CONTAINER || 'family-album-media';

  // Diagnostic GET: list first 10 blobs
  if (req.method === 'GET') {
    try {
      const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
      const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
      let blobs = [];
      for await (const blob of containerClient.listBlobsFlat()) {
        blobs.push(blob.name);
        if (blobs.length >= 10) break;
      }
      context.res = {
        status: 200,
        body: {
          message: 'First 10 blobs in container',
          container: CONTAINER_NAME,
          blobs
        }
      };
    } catch (err) {
      context.res = {
        status: 500,
        body: { error: err.message || String(err) }
      };
    }
    return;
  }

  // POST: rename logic
  let renamed = 0, skipped = 0, errored = 0, total = 0, errors = [];
  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
    const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
    for await (const blob of containerClient.listBlobsFlat()) {
      total++;
      if (blob.name.includes('\\')) {
        try {
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
        } catch (err) {
          errored++;
          errors.push({ blob: blob.name, error: err.message || String(err) });
        }
      } else {
        skipped++;
      }
    }
    context.res = {
      status: 200,
      body: {
        success: true,
        summary: { total, renamed, skipped, errored },
        errors
      }
    };
  } catch (err) {
    context.res = {
      status: 500,
      body: { success: false, error: err.message || String(err) }
    };
  }
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
