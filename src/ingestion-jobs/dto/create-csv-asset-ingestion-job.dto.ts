import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCsvAssetIngestionJobDto {
  @ApiProperty({
    description: 'CSV asset ID to attach with ingestion job',
    format: 'uuid',
  })
  @IsUUID()
  csvAssetId: string;

  @ApiProperty({
    description: 'When this job should run',
    format: 'date-time',
    example: '2026-02-11T10:30:00.000Z',
  })
  @IsDateString()
  scheduledAt: string;

  @ApiProperty({ required: false, description: 'Created by user' })
  @IsOptional()
  @IsString()
  createdBy?: string;
}
