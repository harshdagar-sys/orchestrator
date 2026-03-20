import { Injectable, LoggerService } from '@nestjs/common';
import * as winston from 'winston';
import { extensions, winstonAzureBlob } from 'winston-azure-blob';

@Injectable()
export class AppLogger implements LoggerService {
  private readonly logger: winston.Logger;

  constructor() {
    const serviceName = process.env.SERVICE_NAME || 'orchestrator-service';
    const logLevel = process.env.LOG_LEVEL || 'info';
    const azureBlobBaseName = `orch-${serviceName}`;

    const transports: winston.transport[] = [
      new winston.transports.Console({ level: logLevel }),
    ];

    const azureTransport = this.buildAzureTransport(logLevel, azureBlobBaseName);
    if (azureTransport) transports.push(azureTransport);

    this.logger = winston.createLogger({
      level: logLevel,
      defaultMeta: { service: serviceName },
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json(),
      ),
      transports,
    });
  }

  private buildAzureTransport(level: string, blobName: string) {
    const containerName =
      process.env.AZURE_LOG_CONTAINER || process.env.AZURE_STORAGE_CONTAINER;

    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const accountName = process.env.AZURE_STORAGE_ACCOUNT;
    const accountKey = process.env.AZURE_STORAGE_KEY;

    if (!containerName) {
      console.warn(
        '[LOGGER] Azure blob transport disabled: set AZURE_LOG_CONTAINER (or AZURE_STORAGE_CONTAINER)',
      );
      return null;
    }

    const hasConnectionString = Boolean(connectionString);
    const hasAccountKey = Boolean(accountName && accountKey);

    if (!hasConnectionString && !hasAccountKey) {
      console.warn(
        '[LOGGER] Azure blob transport disabled: set AZURE_STORAGE_CONNECTION_STRING or AZURE_STORAGE_ACCOUNT + AZURE_STORAGE_KEY',
      );
      return null;
    }

    const account = hasConnectionString
      ? { connectionString: connectionString as string }
      : { name: accountName as string, key: accountKey as string };

    try {
      return winstonAzureBlob({
        account: account as any,
        blobName,
        containerName,
        extension: extensions.LOG,
        rotatePeriod: 'YYYY-MM-DD',
        level,
        bufferLogSize: Number(process.env.AZURE_LOG_BUFFER_SIZE || 10), // pick a sane default if you know units
        syncTimeout: Number(process.env.AZURE_LOG_SYNC_TIMEOUT_MS || 2000),
      });
    } catch (error) {
      // IMPORTANT: can't use this.logger yet
      console.error('[LOGGER] Failed to initialize Azure Blob transport', error);
      return null;
    }
  }

  private toMessage(message: unknown): string {
    if (typeof message === 'string') return message;
    if (message instanceof Error) return message.message;
    try {
      return JSON.stringify(message);
    } catch {
      return String(message);
    }
  }

  private contextMeta(context?: string) {
    return context ? { context } : {};
  }

  log(message: unknown, context?: string): void {
    this.logger.info(this.toMessage(message), this.contextMeta(context));
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.logger.error(this.toMessage(message), {
      ...this.contextMeta(context),
      trace,
      stack: trace,
    });
  }

  warn(message: unknown, context?: string): void {
    this.logger.warn(this.toMessage(message), this.contextMeta(context));
  }

  debug(message: unknown, context?: string): void {
    this.logger.debug(this.toMessage(message), this.contextMeta(context));
  }

  verbose(message: unknown, context?: string): void {
    this.logger.verbose(this.toMessage(message), this.contextMeta(context));
  }
}
