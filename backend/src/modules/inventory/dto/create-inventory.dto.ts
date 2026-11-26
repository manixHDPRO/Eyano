import { ScopeType } from "@prisma/client";
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from "class-validator";

export class CreateInventoryDto {
  @IsEnum(ScopeType)
  scopeType!: ScopeType;

  @ValidateIf((dto: CreateInventoryDto) => dto.scopeType === ScopeType.WAREHOUSE)
  @IsUUID()
  warehouseId?: string;

  @ValidateIf((dto: CreateInventoryDto) => dto.scopeType === ScopeType.STORE)
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}