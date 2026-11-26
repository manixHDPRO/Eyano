import { Type } from "class-transformer";
import { IsNumber, IsUUID, Min } from "class-validator";

export class OpenCashSessionDto {
  @IsUUID()
  cashRegisterId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  openingFloatUsd!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(0)
  openingFloatCdf!: number;
}