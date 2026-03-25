import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/primsa/prisma.service';
import { ListIngestionJobRunsQuery } from './dto/list-ingestion-job-runs.query';
import { ListIngestionJobRunProductsQuery } from './dto/list-ingestion-job-run-products.query';
import { IngestionOverallStatus, Prisma, JobRunStatus } from '@prisma/client';

@Injectable()
export class IngestionJobRunsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, q: ListIngestionJobRunsQuery) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const skip = (page - 1) * limit;

    const allowedStatuses = [
      'QUEUED',
      'FETCH_STARTED',
      'COMPLETED',
      'FAILED',
      'FETCH_COMPLETED',
      'CANONICAL_TRANSFORM',
    ];

    const statusNormalized = q.status ? q.status.toUpperCase() : undefined;

    const where: Prisma.IngestionJobRunWhereInput = {
      ...(tenantId ? { job: { tenantId } } : {}),
      ...(q.jobId ? { jobId: q.jobId } : {}),
      ...(statusNormalized && allowedStatuses.includes(statusNormalized)
        ? { status: statusNormalized as JobRunStatus }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.ingestionJobRun.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.ingestionJobRun.count({ where }),
    ]);

    return { page, limit, total, items };
  }

  async findOne(id: string) {
    const run = await this.prisma.ingestionJobRun.findUnique({
      where: { id },
    });
    if (!run) throw new NotFoundException('IngestionJobRun not found');
    return run;
  }

  async findAllProducts(
    tenantId: string,
    q: ListIngestionJobRunProductsQuery,
    jobRunId: string,
  ) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const skip = (page - 1) * limit;

    const productName = q.productName;
    const productSku = q.productSku;
    const overallStatusRaw = q.overallStatus ?? q.overall_status;
    const overallStatusNormalized = overallStatusRaw
      ? overallStatusRaw.toUpperCase()
      : undefined;
    const allowedOverallStatuses = ['IN_PROCESS', 'SUCCESS', 'FAILED'] as const;
    const overallStatus =
      overallStatusNormalized &&
      allowedOverallStatuses.includes(
        overallStatusNormalized as (typeof allowedOverallStatuses)[number],
      )
        ? (overallStatusNormalized as IngestionOverallStatus)
        : undefined;

    const where: Prisma.IngestionJobRunProductWhereInput = {
      jobRunId,
      ...(tenantId ? { jobRun: { job: { tenantId } } } : {}),
      ...(productName ? { productName: { contains: productName } } : {}),
      ...(productSku ? { productSku: { contains: productSku } } : {}),
      ...(overallStatus ? { overallStatus } : {}),
    };

    // Explicit select to avoid querying columns not present in the DB (e.g. job_id).
    const select: Prisma.IngestionJobRunProductSelect = {
      id: true,
      jobRunId: true,
      productId: true,
      productSku: true,
      productName: true,
      operationType: true,
      productDetails: true,
      workerStatus: true,
      workerError: true,
      service1Status: true,
      service1Error: true,
      service2Status: true,
      service2Error: true,
      overallStatus: true,
      createdAt: true,
      updatedAt: true,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.ingestionJobRunProduct.findMany({
        where,
        select,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.ingestionJobRunProduct.count({ where }),
    ]);

    return { page, limit, total, items };
  }
}
