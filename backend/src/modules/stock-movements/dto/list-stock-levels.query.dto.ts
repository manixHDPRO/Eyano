import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";
import type { StockAlertStatus } from "../stock-movements.constants";

export class ListStockLevelsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 25;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;

  @IsOptional()
  @IsEnum(["WAREHOUSE", "STORE", "ALL"])
  locationKind?: "WAREHOUSE" | "STORE" | "ALL";

  @IsOptional()
  @IsEnum(["OK", "LOW", "STOCKOUT"])
  alertStatus?: StockAlertStatus;
}