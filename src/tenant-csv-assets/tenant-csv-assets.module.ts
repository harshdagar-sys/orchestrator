import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/common/primsa/prisma..module';
import { TenantCsvAssetsController } from './tenant-csv-assets.controller';
import { TenantCsvAssetsService } from './tenant-csv-assets.service';
import { StorageModule } from 'src/common/storageModule/storage.module';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [TenantCsvAssetsController],
  providers: [TenantCsvAssetsService],
  exports: [TenantCsvAssetsService],
})
export class TenantCsvAssetsModule {}
