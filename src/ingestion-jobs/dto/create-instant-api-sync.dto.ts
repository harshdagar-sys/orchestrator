import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateInstantApiSyncDto {
  @ApiProperty({
    description: 'Tenant data source id for API sync',
  })
  @IsUUID()
  dataSourceId: string;

  @ApiPropertyOptional({
    description: 'Created by user/email',
  })
  @IsOptional()
  @IsString()
  createdBy?: string;
}
