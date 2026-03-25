import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/primsa/prisma.service';
// import {
//    uploadCsvToAzure,
//   downloadCsvFromAzure,
//   deleteCsvFromAzure,
// } from '../utils/AzureBlob';
import { v4 as uuidv4 } from 'uuid';
import {
  JobMode,
  JobType,
  ScheduleType,
} from '../ingestion-jobs/dto/create-ingestion-job.dto';
import { ListTenantCsvAssetsQuery } from './dto/list-tenant-csv-assets.query';
import { AzureBlobService } from 'src/common/storageModule/azure-blob.service';
import { AppLogger } from 'src/common/logger/app-logger.service';

type UploadedCsvFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};
type CsvDelimiter = ',' | ';' | '\t' | '|';

const serializeAsset = (asset: any) => ({
  ...asset,
  fileSizeBytes:
    typeof asset?.fileSizeBytes === 'bigint'
      ? asset.fileSizeBytes.toString()
      : (asset?.fileSizeBytes ?? null),
});

@Injectable()
export class TenantCsvAssetsService {
  private readonly ctx = TenantCsvAssetsService.name;
  constructor(
    private readonly prisma: PrismaService,
    private readonly azureBlob: AzureBlobService,
    private readonly logger: AppLogger,
  ) {}

  private normalizeHeaderName(value: string): string {
    return (value ?? '')
      .replace(/^\uFEFF/, '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim()
      .replace(/^"|"$/g, '')
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  private countDelimiterOutsideQuotes(
    line: string,
    delimiter: CsvDelimiter,
  ): number {
    let inQuotes = false;
    let count = 0;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          i += 1;
          continue;
        }
        inQuotes = !inQuotes;
        continue;
      }
      if (!inQuotes && char === delimiter) {
        count += 1;
      }
    }

    return count;
  }

  private detectDelimiter(line: string): CsvDelimiter {
    const candidates: CsvDelimiter[] = [',', ';', '\t', '|'];
    const ranked = candidates
      .map((delimiter) => ({
        delimiter,
        count: this.countDelimiterOutsideQuotes(line, delimiter),
      }))
      .sort((a, b) => b.count - a.count);

    return ranked[0].count > 0 ? ranked[0].delimiter : ',';
  }

  private splitCsvLine(line: string, delimiter: CsvDelimiter): string[] {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 1;
          continue;
        }
        inQuotes = !inQuotes;
        continue;
      }

      if (!inQuotes && char === delimiter) {
        cells.push(current);
        current = '';
        continue;
      }

      current += char;
    }

    cells.push(current);
    return cells.map((c) => c.trim());
  }

  private parseHeaderColumnsFromBuffer(
    buffer: Buffer,
    requiredColumns: string[],
  ): string[] {
    const content = buffer.toString('utf8');
    const lines = content.split(/\r?\n/);
    const candidateLines = lines.filter((l) => l && l.trim().length > 0);
    if (candidateLines.length === 0) {
      throw new BadRequestException('CSV file is empty or missing header');
    }
    const normalizedRequired = requiredColumns.map((c) =>
      this.normalizeHeaderName(c),
    );
    const normalizedRequiredSet = new Set(normalizedRequired);

    let bestMatch: { cols: string[]; score: number } | null = null;
    for (const rawLine of candidateLines.slice(0, 30)) {
      const cleanLine = rawLine.replace(/^\uFEFF/, '').trim();
      if (/^sep\s*=\s*[,;|\t]$/i.test(cleanLine)) {
        continue;
      }

      const delimiter = this.detectDelimiter(cleanLine);
      const cols = this.splitCsvLine(cleanLine, delimiter).map((c) =>
        c
          .replace(/^\uFEFF/, '')
          .trim()
          .replace(/^"|"$/g, ''),
      );

      const normalizedColsSet = new Set(
        cols.map((col) => this.normalizeHeaderName(col)),
      );
      const score = normalizedRequired.reduce(
        (acc, required) => acc + (normalizedColsSet.has(required) ? 1 : 0),
        0,
      );

      if (
        !bestMatch ||
        score > bestMatch.score ||
        (score === bestMatch.score && cols.length > bestMatch.cols.length)
      ) {
        bestMatch = { cols, score };
      }

      if (
        normalizedRequiredSet.size > 0 &&
        score === normalizedRequiredSet.size
      ) {
        break;
      }
    }

    if (!bestMatch || bestMatch.cols.length === 0) {
      throw new BadRequestException('CSV file is empty or missing header');
    }

    return bestMatch.cols;
  }

  private validateRequiredColumns(
    mappingColumns: Array<{ csvColumnName: string; isRequired: boolean }>,
    headerCols: string[],
  ): void {
    const requiredColumns = mappingColumns
      .filter((c) => c.isRequired)
      .map((c) => c.csvColumnName);

    const normalizedHeaderSet = new Set(
      headerCols.map((col) => this.normalizeHeaderName(col)),
    );

    const missing = requiredColumns.filter(
      (required) =>
        !normalizedHeaderSet.has(this.normalizeHeaderName(required)),
    );

    if (missing.length > 0) {
      const headerPreview = headerCols.slice(0, 15).join(', ');
      throw new BadRequestException(
        `Missing required CSV columns: ${missing.join(', ')}. Parsed header columns: ${headerPreview}`,
      );
    }
  }

  async uploadCsv(tenantId: string, file: UploadedCsvFile) {
    const allowedMimeTypes = ['text/csv', 'application/vnd.ms-excel'];
    if (!file) {
      throw new BadRequestException('file is required');
    }
    if (!tenantId) {
      throw new BadRequestException('tenantId is required in headers');
    }

    const containerName = process.env.AZURE_STORAGE_CONTAINER;
    if (!containerName) {
      throw new BadRequestException('Azure container name missing');
    }

    const fileUuid = uuidv4();

    const mapping = await this.prisma.csvMapping.findFirst({
      where: {
        tenantId,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!mapping) {
      throw new BadRequestException('No active CSV mapping for tenant');
    }

    // check file type looks like CSV based on extension, we can do more robust check later if needed
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Only CSV allowed');
    }

    // Load mapping columns for this mapping
    const mappingColumns = await this.prisma.csvMappingColumn.findMany({
      where: { csvMappingId: mapping.id },
    });
    if (!mappingColumns || mappingColumns.length === 0) {
      throw new BadRequestException('CSV mapping has no configured columns');
    }
    const requiredColumns = mappingColumns
      .filter((c) => c.isRequired)
      .map((c) => c.csvColumnName);

    const headerCols = this.parseHeaderColumnsFromBuffer(
      file.buffer,
      requiredColumns,
    );

    this.validateRequiredColumns(mappingColumns, headerCols);

    const created = await this.prisma.tenantCsvAsset.create({
      data: {
        tenantId,
        fileUuid,
        originalFileName: file.originalname ?? null,
        containerName,
        fileSizeBytes: BigInt(file.size ?? 0),
        csvMappingId: mapping.id,
        status: null,
        uploadedAt: null,
      },
    });

    try {
      const blobUrl = await this.azureBlob.uploadCsv(file.buffer, fileUuid);

      const updated = await this.prisma.tenantCsvAsset.update({
        where: { id: created.id },
        data: {
          status: 'UPLOADED',
          uploadedAt: new Date(),
        },
      });

      return {
        ...serializeAsset(updated),
        blobUrl,
      };
    } catch (err: any) {
      this.logger.error(
        `CSV upload failed for asset ${created.id}: ${err?.message ?? err}`,
        err?.stack,
        this.ctx,
      );
      await this.prisma.tenantCsvAsset.delete({ where: { id: created.id } });
      throw err;
    }
  }

  async uploadCsvAndCreateJob(
    tenantId: string,
    scheduledAt: string,
    file: UploadedCsvFile,
    createdBy?: string,
  ) {
    if (!file) {
      throw new BadRequestException('file is required');
    }
    if (!tenantId) {
      throw new BadRequestException('tenantId is required in headers');
    }

    const containerName = process.env.AZURE_STORAGE_CONTAINER;
    if (!containerName) {
      throw new BadRequestException('Azure container name missing');
    }

    const fileUuid = uuidv4();
    let blobUploaded = false;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const mapping = await tx.csvMapping.findFirst({
          where: {
            tenantId,
            isActive: true,
          },
          orderBy: { createdAt: 'desc' },
        });

        if (!mapping) {
          throw new BadRequestException('No active CSV mapping for tenant');
        }

        // Validate file extension looks like CSV
        const allowedMimeTypes = ['text/csv', 'application/vnd.ms-excel'];
        if (!allowedMimeTypes.includes(file.mimetype)) {
          throw new BadRequestException('Invalid file type. Only CSV allowed');
        }

        // Load mapping columns for this mapping
        const mappingColumns = await tx.csvMappingColumn.findMany({
          where: { csvMappingId: mapping.id },
        });
        if (!mappingColumns || mappingColumns.length === 0) {
          throw new BadRequestException(
            'CSV mapping has no configured columns',
          );
        }
        const requiredColumns = mappingColumns
          .filter((c) => c.isRequired)
          .map((c) => c.csvColumnName);

        const headerCols = this.parseHeaderColumnsFromBuffer(
          file.buffer,
          requiredColumns,
        );

        this.validateRequiredColumns(mappingColumns, headerCols);

        const createdAsset = await tx.tenantCsvAsset.create({
          data: {
            tenantId,
            fileUuid,
            originalFileName: file.originalname ?? null,
            containerName,
            fileSizeBytes: BigInt(file.size ?? 0),
            csvMappingId: mapping.id,
            status: null,
            uploadedAt: null,
          },
        });

        const blobUrl = await this.azureBlob.uploadCsv(file.buffer, fileUuid);
        blobUploaded = true;

        const job = await tx.ingestionJob.create({
          data: {
            id: uuidv4(),
            tenantId,
            dataSourceId: undefined,
            csvAssetId: createdAsset.id,
            jobType: JobType.CSV,
            jobMode: JobMode.INSTANT,
            scheduleType: ScheduleType.ONE_TIME,
            cronExpression: null,
            scheduledAt,
            isActive: true,
            createdBy,
          },
        });

        const updatedAsset = await tx.tenantCsvAsset.update({
          where: { id: createdAsset.id },
          data: {
            status: 'UPLOADED',
            uploadedAt: new Date(),
          },
        });

        return {
          asset: serializeAsset(updatedAsset),
          job,
          blobUrl,
        };
      });
    } catch (err: any) {
      this.logger.error(
        `Upload+job failed for tenant ${tenantId}: ${err?.message ?? err}`,
        err?.stack,
        this.ctx,
      );
      if (blobUploaded) {
        await this.azureBlob.deleteCsv(fileUuid);
      }
      throw err;
    }
  }

  async findAllByTenant(tenantId: string, q?: ListTenantCsvAssetsQuery) {
    if (!q?.page && !q?.limit) {
      const assets = await this.prisma.tenantCsvAsset.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      });
      return assets.map(serializeAsset);
    }

    const page = q?.page ?? 1;
    const limit = q?.limit ?? 20;
    const skip = (page - 1) * limit;

    const [assets, total] = await this.prisma.$transaction([
      this.prisma.tenantCsvAsset.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.tenantCsvAsset.count({
        where: { tenantId },
      }),
    ]);

    return {
      page,
      limit,
      total,
      items: assets.map(serializeAsset),
    };
  }

  async getDownloadStream(id: string) {
    const asset = await this.prisma.tenantCsvAsset.findUnique({
      where: { id },
    });
    if (!asset) throw new NotFoundException('CSV asset not found');

    const stream = await this.azureBlob.downloadCsv(asset.fileUuid);
    if (!stream) {
      this.logger.error(
        `CSV file not found in Azure for asset ${asset.id}`,
        this.ctx,
      );
      throw new NotFoundException('CSV file not found in Azure');
    }

    const downloadName =
      asset.originalFileName && asset.originalFileName.trim().length > 0
        ? asset.originalFileName
        : `${asset.fileUuid}.csv`;

    return { stream, downloadName };
  }
}
