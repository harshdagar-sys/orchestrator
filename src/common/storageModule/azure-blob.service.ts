import { Injectable } from '@nestjs/common';
import { BlobServiceClient } from '@azure/storage-blob';
import { Readable } from 'stream';
import { AppLogger } from '../logger/app-logger.service';

@Injectable()
export class AzureBlobService {
  private readonly ctx = AzureBlobService.name;

  constructor(private readonly logger: AppLogger) {}

  private getClient() {
    const account = process.env.AZURE_STORAGE_ACCOUNT!;
    const key = process.env.AZURE_STORAGE_KEY!;
    const containerName = process.env.AZURE_STORAGE_CONTAINER!;

    if (!account || !key || !containerName) {
      throw new Error('Azure env variables are missing');
    }

    const connectionString =
      `DefaultEndpointsProtocol=https;AccountName=${account};AccountKey=${key};EndpointSuffix=core.windows.net`;

    const blobServiceClient =
      BlobServiceClient.fromConnectionString(connectionString);

    const containerClient =
      blobServiceClient.getContainerClient(containerName);

    return { containerClient };
  }

  async uploadCsv(data: Buffer, fileName: string): Promise<string> {
    const { containerClient } = this.getClient();
    await containerClient.createIfNotExists();

    const blockBlobClient =
      containerClient.getBlockBlobClient(fileName);

    const response = await blockBlobClient.uploadData(data, {
      blobHTTPHeaders: { blobContentType: 'text/csv' },
    });

    if (response._response.status === 201) {
      this.logger.log(`CSV uploaded: ${fileName}`, this.ctx);
      return blockBlobClient.url;
    }

    this.logger.error(`CSV upload failed: ${fileName}`, undefined, this.ctx);
    throw new Error('CSV not uploaded');
  }

  async downloadCsv(fileName: string): Promise<Readable | undefined> {
    const { containerClient } = this.getClient();
    const blockBlobClient =
      containerClient.getBlockBlobClient(fileName);

    try {
      const response = await blockBlobClient.download(0);

      if (!response.readableStreamBody) return undefined;

      this.logger.log(`CSV downloaded: ${fileName}`, this.ctx);

      return response.readableStreamBody as unknown as Readable;
    } catch (err: any) {
      if (err?.statusCode === 404) {
        this.logger.warn(`CSV not found: ${fileName}`, this.ctx);
        return undefined;
      }

      const stack = err instanceof Error ? err.stack : undefined;
      this.logger.error(`Download failed: ${fileName}`, stack, this.ctx);
      throw err;
    }
  }

  async deleteCsv(fileName: string): Promise<void> {
    const { containerClient } = this.getClient();
    const blockBlobClient =
      containerClient.getBlockBlobClient(fileName);

    try {
      await blockBlobClient.deleteIfExists();
      this.logger.log(`CSV deleted: ${fileName}`, this.ctx);
    } catch (err) {
      const stack = err instanceof Error ? err.stack : undefined;
      this.logger.warn(`Delete failed: ${fileName}`, this.ctx);
      if (stack) {
        this.logger.debug(stack, this.ctx);
      }
    }
  }
}