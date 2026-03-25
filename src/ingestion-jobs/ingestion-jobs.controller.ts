import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { IngestionJobsService } from './ingestion-jobs.service';
import { CreateIngestionJobDto } from './dto/create-ingestion-job.dto';
import { UpdateIngestionJobDto } from './dto/update-ingestion-job.dto';
import { ListIngestionJobsQuery } from './dto/list-ingestion-jobs.query';
import { ActivateIngestionJobDto } from './dto/activate-ingestion-job.dto';
import { CreateCsvAssetIngestionJobDto } from './dto/create-csv-asset-ingestion-job.dto';
import { CreateInstantApiSyncDto } from './dto/create-instant-api-sync.dto';
import {
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Ingestion Jobs')
@ApiHeader({ name: 'x-tenant-id', required: true, description: 'Tenant ID' })
@Controller('ingestion-jobs')
export class IngestionJobsController {
  constructor(private readonly svc: IngestionJobsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new ingestion job for api' })
  @ApiBody({ type: CreateIngestionJobDto })
  create(
    @Body() dto: CreateIngestionJobDto,
    @Headers() headers: Record<string, string>,
  ) {
    const tenantId = headers['x-tenant-id'];
    if (!tenantId)
      throw new BadRequestException('tenantId is required in headers');
    return this.svc.create(tenantId, dto);
  }

  @Post('csv-asset')
  @ApiOperation({
    summary:
      'Create CSV ingestion job using csvAssetId and scheduledAt (other fields set by backend)',
  })
  @ApiBody({ type: CreateCsvAssetIngestionJobDto })
  createCsvAssetJob(
    @Body() dto: CreateCsvAssetIngestionJobDto,
    @Headers() headers: Record<string, string>,
  ) {
    const tenantId = headers['x-tenant-id'];
    if (!tenantId)
      throw new BadRequestException('tenantId is required in headers');
    return this.svc.createCsvAssetJob(tenantId, dto);
  }

  @Post('instant-api-sync')
  @ApiOperation({
    summary: 'Create an instant one-time API ingestion job using dataSourceId',
  })
  @ApiBody({ type: CreateInstantApiSyncDto })
  createInstantApiSync(
    @Body() dto: CreateInstantApiSyncDto,
    @Headers() headers: Record<string, string>,
  ) {
    const tenantId = headers['x-tenant-id'];
    if (!tenantId) {
      throw new BadRequestException('tenantId is required in headers');
    }
    return this.svc.createInstantApiSync(tenantId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List ingestion jobs with pagination and filters' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'jobMode',
    required: false,
    enum: ['SCHEDULED', 'INSTANT'],
  })
  @ApiQuery({
    name: 'scheduleType',
    required: false,
    enum: ['CRON', 'ONE_TIME'],
  })
  @ApiQuery({
    name: 'date',
    required: false,
    type: String,
    description:
      'UTC date filter (ISO), includes ONE_TIME scheduledAt and CRON occurrences on that day',
  })
  findAll(
    @Query() q: ListIngestionJobsQuery,
    @Headers() headers: Record<string, string>,
  ) {
    const tenantId = headers['x-tenant-id'];
    if (!tenantId)
      throw new BadRequestException('tenantId is required in headers');
    return this.svc.findAll(tenantId, q);
  }

  @Get('stats')
  @ApiOperation({
    summary:
      'Get ingestion job counts (active, deactivated, completed) and last sync details',
  })
  getStats(@Headers() headers: Record<string, string>) {
    const tenantId = headers['x-tenant-id'];
    if (!tenantId)
      throw new BadRequestException('tenantId is required in headers');
    return this.svc.getStats(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get ingestion job by id' })
  @ApiParam({ name: 'id', description: 'Ingestion job ID' })
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  // @Patch(':id')
  // @ApiOperation({ summary: 'Update ingestion job' })
  // @ApiParam({ name: 'id', description: 'Ingestion job ID' })
  // @ApiBody({ type: UpdateIngestionJobDto })
  // update(@Param('id') id: string, @Body() dto: UpdateIngestionJobDto) {
  //   return this.svc.update(id, dto);
  // }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete ingestion job' })
  @ApiParam({ name: 'id', description: 'Ingestion job ID' })
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }

  @Post('update-status')
  @ApiOperation({
    summary: 'Activate and deactivete ingestion job.',
  })
  @ApiBody({ type: ActivateIngestionJobDto })
  activateJob(
    @Body() dto: ActivateIngestionJobDto,
    @Headers() headers: Record<string, string>,
  ) {
    const tenantId = headers['x-tenant-id'];
    if (!tenantId)
      throw new BadRequestException('tenantId is required in headers');
    return this.svc.activateJob(tenantId, dto.jobId, dto.status);
  }
}
