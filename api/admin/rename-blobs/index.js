const { BlobServiceClient } = require('@azure/storage-blob');





module.exports = async function (context, req) {
  try {
    context.res = {
      status: 200,
      body: `Minimal test: /api/admin/rename-blobs endpoint is working for ${req.method} request.`
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
