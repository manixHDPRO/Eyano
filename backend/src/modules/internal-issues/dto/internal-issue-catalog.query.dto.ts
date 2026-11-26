import { ScopeType } from "@prisma/client";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateIf } from "class-validator";

export class InternalIssueCatalogQueryDto {
  @IsEnum(ScopeType)
  scopeType!: ScopeType;

  @ValidateIf((dto: InternalIssueCatalogQueryDto) => dto.scopeType === ScopeType.WAREHOUSE)
  @IsUUID()
  warehouseId?: string;

  @ValidateIf((dto: InternalIssueCatalogQueryDto) => dto.scopeType === ScopeType.STORE)
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 30;
}