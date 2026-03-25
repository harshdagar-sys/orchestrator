import { BadRequestException, Controller, Get, Headers } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantDataSourceService } from './tenant-data-source.service';

@ApiTags('Tenant Data Sources')
@ApiHeader({ name: 'x-tenant-id', required: true, description: 'Tenant ID' })
@Controller('tenant-data-sources')
export class TenantDataSourceController {
  constructor(private readonly svc: TenantDataSourceService) {}

  @Get()
  @ApiOperation({ summary: 'Get all data sources for a tenant' })
  findAllByTenant(@Headers() headers: Record<string, string>) {
    const tenantId = headers['x-tenant-id'];
    if (!tenantId)
      throw new BadRequestException('tenantId is required in headers');
    return this.svc.findAllByTenant(tenantId);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get active data source for a tenant' })
  findActiveByTenant(@Headers() headers: Record<string, string>) {
    const tenantId = headers['x-tenant-id'];
    if (!tenantId)
      throw new BadRequestException('tenantId is required in headers');
    return this.svc.findActiveByTenant(tenantId);
  }
}
