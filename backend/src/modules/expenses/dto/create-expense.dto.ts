import { CurrencyCode, ScopeType } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";
import { EXPENSE_CATEGORIES, type ExpenseCategoryCode } from "../expenses.constants";

export class CreateExpenseDto {
  @IsEnum(ScopeType)
  scopeType!: ScopeType;

  @ValidateIf((dto: CreateExpenseDto) => dto.scopeType === ScopeType.WAREHOUSE)
  @IsUUID()
  warehouseId?: string;

  @ValidateIf((dto: CreateExpenseDto) => dto.scopeType === ScopeType.STORE)
  @IsUUID()
  storeId?: string;

  @IsIn([...EXPENSE_CATEGORIES])
  category!: ExpenseCategoryCode;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999_999_999)
  amount!: number;

  @IsEnum(CurrencyCode)
  currency!: CurrencyCode;

  @IsOptional()
  @IsISO8601()
  spentAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  /** Si vrai, la dépense est prélevée sur le tiroir (session ouverte obligatoire). */
  @IsOptional()
  @IsBoolean()
  fromCashDrawer?: boolean;

  @ValidateIf((dto: CreateExpenseDto) => dto.fromCashDrawer === true)
  @IsOptional()
  @IsUUID()
  cashSessionId?: string;

  @ValidateIf((dto: CreateExpenseDto) => dto.fromCashDrawer === true && !dto.cashSessionId)
  @IsOptional()
  @IsUUID()
  cashRegisterId?: string;
}