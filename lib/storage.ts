import { 
  BlobServiceClient, 
  ContainerClient, 
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  StorageSharedKeyCredential
} from '@azure/storage-blob';

const accountName = process.env.AZURE_STORAGE_ACCOUNT || '';
const accountKey = process.env.AZURE_STORAGE_KEY || '';
const containerName = process.env.AZURE_STORAGE_CONTAINER || 'family-album-media';

let blobServiceClient: BlobServiceClient | null = null;
let containerClient: ContainerClient | null = null;

function getBlobServiceClient(): BlobServiceClient {
  if (!blobServiceClient) {
    const connectionString = `DefaultEndpointsProtocol=https;AccountName=${accountName};AccountKey=${accountKey};EndpointSuffix=core.windows.net`;
    blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  }
  return blobServiceClient;
}

export function getContainerClient(): ContainerClient {
  if (!containerClient) {
    const serviceClient = getBlobServiceClient();
    containerClient = serviceClient.getContainerClient(containerName);
  }
  return containerClient;
}

export async function uploadBlob(
  blobName: string,
  content: Buffer,
  contentType: string
): Promise<string> {
  const containerClient = getContainerClient();
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  await blockBlobClient.upload(content, content.length, {
    blobHTTPHeaders: { blobContentType: contentType },
  });

  return blockBlobClient.url;
}

export async function downloadBlob(blobName: string): Promise<Buffer> {
  const containerClient = getContainerClient();
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  const downloadResponse = await blockBlobClient.download();
  const chunks: Buffer[] = [];

  if (downloadResponse.readableStreamBody) {
    for await (const chunk of downloadResponse.readableStreamBody) {
      chunks.push(Buffer.from(chunk));
    }
  }

  return Buffer.concat(chunks);
}

export async function deleteBlob(blobName: string): Promise<void> {
  const containerClient = getContainerClient();
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.deleteIfExists();
}

export async function listBlobs(prefix?: string): Promise<string[]> {
  const containerClient = getContainerClient();
  const blobNames: string[] = [];

  for await (const blob of containerClient.listBlobsFlat({ prefix })) {
    blobNames.push(blob.name);
  }

  return blobNames;
}

export async function blobExists(blobName: string): Promise<boolean> {
  const containerClient = getContainerClient();
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  return await blockBlobClient.exists();
}

/**
 * Generate a SAS URL for direct upload from browser
 * @param blobName The name/path of the blob to upload
 * @param expiresInMinutes How long the SAS token should be valid (default: 60 minutes)
 * @returns SAS URL that allows uploading to this specific blob
 */
export function generateUploadSasUrl(blobName: string, expiresInMinutes: number = 60): string {
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
