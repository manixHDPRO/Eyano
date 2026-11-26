import { ExchangeRateType } from "@prisma/client";
import { Type } from "class-transformer";
import { IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class UpdateExchangeRateDto {
  @IsEnum(ExchangeRateType)
  rateType!: ExchangeRateType;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(1)
  rate!: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}