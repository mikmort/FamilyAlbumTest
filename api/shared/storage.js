const { 
  BlobServiceClient,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  StorageSharedKeyCredential
} = require('@azure/storage-blob');

const accountName = process.env.AZURE_STORAGE_ACCOUNT || '';
const accountKey = process.env.AZURE_STORAGE_KEY || '';
const containerName = process.env.AZURE_STORAGE_CONTAINER || 'family-album-media';

let blobServiceClient = null;
let containerClient = null;

function getBlobServiceClient() {
  if (!blobServiceClient) {
    const connectionString = `DefaultEndpointsProtocol=https;AccountName=${accountName};AccountKey=${accountKey};EndpointSuffix=core.windows.net`;
    blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  }
  return blobServiceClient;
}

function getContainerClient() {
  if (!containerClient) {
    const serviceClient = getBlobServiceClient();
    containerClient = serviceClient.getContainerClient(containerName);
  }
  return containerClient;
}

async function uploadBlob(blobName, content, contentType) {
  const containerClient = getContainerClient();
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  await blockBlobClient.upload(content, content.length, {
    blobHTTPHeaders: { blobContentType: contentType },
  });

  return blockBlobClient.url;
}

async function downloadBlob(blobName) {
  const containerClient = getContainerClient();
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  const downloadResponse = await blockBlobClient.download();
  const chunks = [];

  if (downloadResponse.readableStreamBody) {
    for await (const chunk of downloadResponse.readableStreamBody) {
      chunks.push(Buffer.from(chunk));
    }
  }

  return Buffer.concat(chunks);
}

async function deleteBlob(blobName) {
  const containerClient = getContainerClient();
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.deleteIfExists();
}

async function blobExists(blobName) {
  const containerClient = getContainerClient();
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  return await blockBlobClient.exists();
}

/**
 * Generate a SAS URL for direct upload from browser
 * @param {string} blobName - The name/path of the blob to upload
 * @param {number} expiresInMinutes - How long the SAS token should be valid (default: 60 minutes)
 * @returns {string} SAS URL that allows uploading to this specific blob
 */
function generateUploadSasUrl(blobName, expiresInMinutes = 60) {
  const containerClient = getContainerClient();
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  
  // Create a SAS token that expires in the specified minutes
  const startsOn = new Date();
  const expiresOn = new Date(startsOn.getTime() + expiresInMinutes * 60 * 1000);
  
  // Create shared key credential
  const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
  
  // Define permissions (write only for upload)
  const permissions = BlobSASPermissions.parse("cw"); // create and write
  
  // Generate SAS token
  const sasToken = generateBlobSASQueryParameters(
    {
      containerName: containerName,
      blobName: blobName,
      permissions: permissions,
      startsOn: startsOn,
      expiresOn: expiresOn,
    },
    sharedKeyCredential
  ).toString();
  
  // Return full URL with SAS token
  return `${blockBlobClient.url}?${sasToken}`;
}

/**
 * Generate a SAS URL for reading a blob from browser
 * @param {string} containerName - The container name
 * @param {string} blobName - The name/path of the blob to read
 * @param {number} expiresInMinutes - How long the SAS token should be valid (default: 60 minutes)
 * @returns {string} SAS URL that allows reading this specific blob
 */
function getBlobSasUrl(container, blobName, expiresInMinutes = 60) {
  const serviceClient = getBlobServiceClient();
  const containerClient = serviceClient.getContainerClient(container);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  
  // Create a SAS token that expires in the specified minutes
  const startsOn = new Date();
  const expiresOn = new Date(startsOn.getTime() + expiresInMinutes * 60 * 1000);
  
  // Create shared key credential
  const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
  
  // Define permissions (read only)
  const permissions = BlobSASPermissions.parse("r"); // read
  
  // Generate SAS token
  const sasToken = generateBlobSASQueryParameters(
    {
      containerName: container,
      blobName: blobName,
      permissions: permissions,
      startsOn: startsOn,
      expiresOn: expiresOn,
    },
    sharedKeyCredential
  ).toString();
  
  // Return full URL with SAS token
  return `${blockBlobClient.url}?${sasToken}`;
}

module.exports = { 
  uploadBlob, 
  downloadBlob, 
  deleteBlob, 
  blobExists, 
  getContainerClient,
  generateUploadSasUrl,
  getBlobSasUrl
};
