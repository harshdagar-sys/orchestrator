import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  BlobServiceClient,
  StorageSharedKeyCredential,
} from '@azure/storage-blob';
import { Readable } from 'stream';
import { AppLogger } from 'src/common/logger/app-logger.service';

@Injectable()
export class LogsService {
  private readonly ctx = LogsService.name;

  constructor(private readonly logger: AppLogger) {}

  async downloadOrchestratorLog(query: { date?: string; blobName?: string }) {
    const blobName = this.resolveBlobName(query);
    const containerClient = this.getContainerClient();
    const blobClient = containerClient.getBlobClient(blobName);

    try {
      const response = await blobClient.download(0);
      const stream = response.readableStreamBody;
      if (!stream) {
        throw new NotFoundException(`Log file has no content: ${blobName}`);
      }

      const content = await this.streamToBuffer(stream as unknown as Readable);

      this.logger.log(`Downloaded orchestrator log: ${blobName}`, this.ctx);

      return { fileName: blobName, content };
    } catch (err: any) {
      if (err?.statusCode === 404) {
        this.logger.warn(`Log file not found: ${blobName}`, this.ctx);
        throw new NotFoundException(`Log file not found: ${blobName}`);
      }

      const stack = err instanceof Error ? err.stack : undefined;
      this.logger.error(
        `Failed to download log file: ${blobName}`,
        stack,
        this.ctx,
      );
      throw new InternalServerErrorException('Failed to download log file');
    }
  }

  private resolveBlobName(query: { date?: string; blobName?: string }) {
    if (query.blobName) return query.blobName;

    const date = query.date;
    if (!date) {
      throw new BadRequestException(
        'Provide either blobName or date (YYYY-MM-DD)',
      );
    }

    const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(date);
    if (!isValidDate) {
      throw new BadRequestException('Invalid date. Use YYYY-MM-DD');
    }

    const serviceName = process.env.SERVICE_NAME || 'orchestrator-service';
    return `orch-${serviceName}.${date}.log`;
  }

  private getContainerClient() {
    const containerName =
      process.env.AZURE_LOG_CONTAINER || process.env.AZURE_STORAGE_CONTAINER;
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const accountName = process.env.AZURE_STORAGE_ACCOUNT;
    const accountKey = process.env.AZURE_STORAGE_KEY;

    if (!containerName) {
      throw new InternalServerErrorException(
        'Azure log container is not configured',
      );
    }

    let blobServiceClient: BlobServiceClient;
    if (connectionString) {
      blobServiceClient =
        BlobServiceClient.fromConnectionString(connectionString);
    } else if (accountName && accountKey) {
      const credential = new StorageSharedKeyCredential(
        accountName,
        accountKey,
      );
      blobServiceClient = new BlobServiceClient(
        `https://${accountName}.blob.core.windows.net`,
        credential,
      );
    } else {
      throw new InternalServerErrorException(
        'Azure storage credentials are not configured',
      );
    }

    return blobServiceClient.getContainerClient(containerName);
  }

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}
