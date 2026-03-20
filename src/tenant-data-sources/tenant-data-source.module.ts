import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/common/primsa/prisma..module';
import { TenantDataSourceService } from './tenant-data-source.service';
import { TenantDataSourceController } from './tenant-data-source.controller';

@Module({
  imports: [PrismaModule],
  controllers: [TenantDataSourceController],
  providers: [TenantDataSourceService],
  exports: [TenantDataSourceService],
})
export class TenantDataSourceModule {}
