import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListIngestionJobRunProductsQuery {
  @IsOptional()
  @IsString()
  jobRunId?: string;

  @IsOptional()
  @IsString()
  job_run_id?: string;

  @IsOptional()
  @IsString()
  productName?: string;

  @IsOptional()
  @IsString()
  productSku?: string;

  @IsOptional()
  @IsString()
  product_name?: string;

  @IsOptional()
  @IsString()
  product_sku?: string;

  @IsOptional()
  @IsString()
  overallStatus?: string;

  @IsOptional()
  @IsString()
  overall_status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
