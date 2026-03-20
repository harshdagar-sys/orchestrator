import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
export enum Status {
  ACTIVE = 'ACTIVE',
  DEACTIVATED = 'DEACTIVATED',
}
export class ActivateIngestionJobDto {
  @ApiProperty({ description: 'Job ID to activate' })
  @IsNotEmpty()
  @IsString()
  jobId: string;

  @ApiProperty({ description: 'status' })
  @IsNotEmpty()
  @IsString()
  status: Status;
}
