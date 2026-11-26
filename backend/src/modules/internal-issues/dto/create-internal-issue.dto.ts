import { InternalIssueReason, ScopeType } from "@prisma/client";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateIf } from "class-validator";

export class CreateInternalIssueDto {
  @IsEnum(ScopeType)
  scopeType!: ScopeType;

  @ValidateIf((dto: CreateInternalIssueDto) => dto.scopeType === ScopeType.WAREHOUSE)
  @IsUUID()
  warehouseId?: string;

  @ValidateIf((dto: CreateInternalIssueDto) => dto.scopeType === ScopeType.STORE)
  @IsUUID()
  storeId?: string;

  @IsUUID()
  productId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  quantity!: number;

  @IsEnum(InternalIssueReason)
  reasonCode!: InternalIssueReason;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reasonText?: string;
}