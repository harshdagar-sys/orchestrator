import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { IngestionJobRunsService } from './ingestion-job-runs.service';
import { ListIngestionJobRunsQuery } from './dto/list-ingestion-job-runs.query';
import { ListIngestionJobRunProductsQuery } from './dto/list-ingestion-job-run-products.query';

@ApiTags('Ingestion Job Runs')
@ApiHeader({ name: 'x-tenant-id', required: true, description: 'Tenant ID' })
@Controller('ingestion-job-runs')
export class IngestionJobRunsController {
  constructor(private readonly svc: IngestionJobRunsService) {}

  @Get()
  @ApiOperation({
    summary: 'List ingestion job runs with pagination and filters',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'jobId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  findAll(
    @Query() q: ListIngestionJobRunsQuery,
    @Headers() headers: Record<string, string>,
  ) {
    const tenantId = headers['x-tenant-id'];
    if (!tenantId)
      throw new BadRequestException('tenantId is required in headers');
    return this.svc.findAll(tenantId, q);
  }

  @Get('products')
  @ApiOperation({
    summary: 'List ingestion job run products with pagination and filters',
  })
  // @ApiQuery({ name: 'job_run_id', required: true, type: String })
  @ApiQuery({ name: 'jobRunId', required: true, type: String })
  @ApiQuery({ name: 'productName', required: false, type: String })
  @ApiQuery({ name: 'productSku', required: false, type: String })
  @ApiQuery({ name: 'overallStatus', required: false, type: String })
  // @ApiQuery({ name: 'product_name', required: false, type: String })
  // @ApiQuery({ name: 'product_sku', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAllProducts(
    @Query() q: ListIngestionJobRunProductsQuery,
    @Headers() headers: Record<string, string>,
  ) {
    const tenantId = headers['x-tenant-id'];
    if (!tenantId)
      throw new BadRequestException('tenantId is required in headers');
    const jobRunId = q.jobRunId;
    if (!jobRunId)
      throw new BadRequestException('job_run_id is required in query');
    return this.svc.findAllProducts(tenantId, q, jobRunId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get ingestion job run by id' })
  @ApiParam({ name: 'id', description: 'Ingestion job run ID' })
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }
}
