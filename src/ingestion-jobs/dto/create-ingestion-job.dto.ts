import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ScheduleInput } from 'src/utils/schedule-to-cron';
export enum JobType {
  CSV = 'CSV',
  API = 'API',
}

export enum JobMode {
  SCHEDULED = 'SCHEDULED',
  INSTANT = 'INSTANT',
  // PRIORITY = 'PRIORITY',
}

export enum ScheduleType {
  CRON = 'CRON',
  ONE_TIME = 'ONE_TIME',
}

export class CreateIngestionJobDto {
  @ApiProperty()
  @IsUUID()
  dataSourceId: string;

  // @ApiProperty()
  // @IsOptional()
  // @IsUUID()
  // csvAssetId?: string;

  // @ApiProperty()
  // @IsEnum(JobType)
  // jobType: JobType;

  // @ApiProperty()
  // @IsEnum(JobMode)
  // schedule: JobMode;

  @ApiProperty()
  @IsOptional()
  @IsEnum(ScheduleType)
  jobType?: ScheduleType;

  // @ApiProperty()
  // @IsOptional()
  // @IsString()
  // cronExpression?: string;

  @ApiProperty()
  @IsOptional()
  scheduledAt?: Date;

  @ApiProperty()
  @IsOptional()
  scheduleType: ScheduleInput;

  @ApiProperty()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty()
  @IsOptional()
  @IsString()
  createdBy?: string;
}
