import { CurrencyCode, PaymentMethod } from "@prisma/client";
import { Type } from "class-transformer";
import { IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength, ValidateIf } from "class-validator";

export class CreateSalePaymentDto {
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsEnum(CurrencyCode)
  currency!: CurrencyCode;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ValidateIf((row: CreateSalePaymentDto) =>
    row.method === PaymentMethod.MPESA ||
    row.method === PaymentMethod.ORANGE_MONEY ||
    row.method === PaymentMethod.AIRTEL_MONEY,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  providerReference?: string;
}