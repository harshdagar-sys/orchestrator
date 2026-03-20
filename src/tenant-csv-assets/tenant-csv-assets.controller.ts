import {
  Body,
  BadRequestException,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { TenantCsvAssetsService } from './tenant-csv-assets.service';
import { ListTenantCsvAssetsQuery } from './dto/list-tenant-csv-assets.query';

type UploadedCsvFile = {
  originalname: string;
  size: number;
  buffer: Buffer;
  mimetype: string;
};

@ApiTags('Tenant CSV Assets')
@ApiHeader({ name: 'x-tenant-id', required: true, description: 'Tenant ID' })
@Controller('tenant-csv-assets')
export class TenantCsvAssetsController {
  constructor(private readonly svc: TenantCsvAssetsService) { }

  @Post('upload')
  @ApiOperation({ summary: 'Upload CSV to Azure and create asset record' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  uploadCsv(
    @UploadedFile() file: UploadedCsvFile,
    @Headers() headers: Record<string, string>,
  ) {
    const tenantId = headers['x-tenant-id'];
    if (!tenantId) throw new BadRequestException('tenantId is required in headers');
    return this.svc.uploadCsv(tenantId, file);
  }

  // @Post('upload-and-job')
  // @ApiOperation({ summary: 'Upload CSV and create one-time ingestion job' })
  // @ApiConsumes('multipart/form-data')
  // @ApiBody({
  //   schema: {
  //     type: 'object',
  //     required: ['scheduledAt', 'file'],
  //     properties: {
  //       scheduledAt: { type: 'string', format: 'date-time' },
  //       createdBy: { type: 'string' },
  //       file: { type: 'string', format: 'binary' },
  //     },
  //   },
  // })
  // @UseInterceptors(FileInterceptor('file'))
  // uploadCsvAndCreateJob(
  //   @UploadedFile() file: UploadedCsvFile,
  //   @Body() { scheduledAt, createdBy }: { scheduledAt: string, createdBy?: string },
  //   @Headers() headers: Record<string, string>,
  // ) {
  //   const tenantId = headers['x-tenant-id'];
  //   if (!tenantId) throw new BadRequestException('tenantId is required in headers');
  //   return this.svc.uploadCsvAndCreateJob(tenantId, scheduledAt, file);
  // }

  @Get()
  @ApiOperation({ summary: 'Get all CSV assets for a tenant' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAllByTenant(
    @Headers() headers: Record<string, string>,
    @Query() q: ListTenantCsvAssetsQuery,
  ) {
    const tenantId = headers['x-tenant-id'];
    if (!tenantId) throw new BadRequestException('tenantId is required in headers');
    return this.svc.findAllByTenant(tenantId, q);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download CSV file' })
  @ApiParam({ name: 'id', description: 'Tenant CSV asset ID' })
  async download(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { stream, downloadName } = await this.svc.getDownloadStream(id);
    return new StreamableFile(stream, {
      type: 'text/csv',
      disposition: `attachment; filename="${downloadName}.csv"`,
    });
  }
}
