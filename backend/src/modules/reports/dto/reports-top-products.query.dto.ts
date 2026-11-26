import { Type } from "class-transformer";
import { IsISO8601, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

export class ReportsTopProductsQueryDto {
  @IsUUID()
  storeId!: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}