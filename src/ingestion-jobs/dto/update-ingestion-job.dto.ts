import { PartialType } from '@nestjs/mapped-types';
import { CreateIngestionJobDto } from './create-ingestion-job.dto';

export class UpdateIngestionJobDto extends PartialType(CreateIngestionJobDto) {}
