import { Logger } from '@nestjs/common';
import { BlobServiceClient } from '@azure/storage-blob';
import { Readable } from 'stream';

const logger = new Logger('AzureBlob');

export const uploadCsvToAzure = async (
  data: Buffer,
  fileName: string,
): Promise<string> => {
  const account = process.env.AZURE_STORAGE_ACCOUNT!;
  const key = process.env.AZURE_STORAGE_KEY!;
  const containerName = process.env.AZURE_STORAGE_CONTAINER!;

  if (!account || !key || !containerName) {
    throw new Error('Azure env variables are missing');
  }

  const connectionString = `DefaultEndpointsProtocol=https;AccountName=${account};AccountKey=${key};EndpointSuffix=core.windows.net`;

  const blobServiceClient =
    BlobServiceClient.fromConnectionString(connectionString);

  const containerClient = blobServiceClient.getContainerClient(containerName);

  await containerClient.createIfNotExists();

  const blockBlobClient = containerClient.getBlockBlobClient(fileName);

  const response = await blockBlobClient.uploadData(data, {
    blobHTTPHeaders: {
      blobContentType: 'text/csv',
    },
  });

  if (response._response.status === 201) {
    logger.log(`CSV uploaded: ${fileName}`);
    return blockBlobClient.url;
  }

  throw new Error('CSV not uploaded');
};

export const downloadCsvFromAzure = async (
  fileName: string,
): Promise<Readable | undefined> => {
  const account = process.env.AZURE_STORAGE_ACCOUNT!;
  const key = process.env.AZURE_STORAGE_KEY!;
  const containerName = process.env.AZURE_STORAGE_CONTAINER!;

  if (!account || !key || !containerName) {
    throw new Error('Azure env variables are missing');
  }

  const connectionString = `DefaultEndpointsProtocol=https;AccountName=${account};AccountKey=${key};EndpointSuffix=core.windows.net`;

  const blobServiceClient =
    BlobServiceClient.fromConnectionString(connectionString);

  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(fileName);

  try {
    const response = await blockBlobClient.download(0);

    if (!response.readableStreamBody) return undefined;

    return response.readableStreamBody as unknown as Readable;
  } catch (err: any) {
    if (err?.statusCode === 404) return undefined;
    throw err;
  }
};

export const downloadCsvBufferFromAzure = async (
  fileName: string,
): Promise<Buffer> => {
  const stream = await downloadCsvFromAzure(fileName);

  if (!stream) throw new Error('File not found');

  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
};

export const deleteCsvFromAzure = async (fileName: string): Promise<void> => {
  const account = process.env.AZURE_STORAGE_ACCOUNT!;
  const key = process.env.AZURE_STORAGE_KEY!;
  const containerName = process.env.AZURE_STORAGE_CONTAINER!;

  if (!account || !key || !containerName) {
    throw new Error('Azure env variables are missing');
  }

  const connectionString = `DefaultEndpointsProtocol=https;AccountName=${account};AccountKey=${key};EndpointSuffix=core.windows.net`;

  const blobServiceClient =
    BlobServiceClient.fromConnectionString(connectionString);

  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(fileName);

  try {
    await blockBlobClient.deleteIfExists();
  } catch {
    // best-effort cleanup
  }
};
