import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/primsa/prisma.service';

@Injectable()
export class TenantDataSourceService {
  constructor(private readonly prisma: PrismaService) {}

  findActiveByTenant(tenantId: string): Promise<any> {
    return this.prisma.tenantDataSource.findFirst({
      where: {
        tenantId,
        enabled: true,
      },
    });
  }

  findAllByTenant(tenantId: string): Promise<any[]> {
    return this.prisma.tenantDataSource.findMany({
      where: {
        tenantId,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(data: {
    tenantId: string;
    domain: string;
    chunkSize?: number;
    endpoint?: string;
    method?: string;
    headers?: any;
    authConfig?: any;
    payloadTemplate?: any;
    paginationType?: string;
    paginationConfig?: any;
    csvPath?: string;
    csvMapping?: any;
  }): Promise<any> {
    return this.prisma.tenantDataSource.create({ data });
  }
}
