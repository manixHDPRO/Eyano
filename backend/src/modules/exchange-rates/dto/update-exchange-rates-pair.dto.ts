import { Type } from "class-transformer";
import { IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class UpdateExchangeRatesPairDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(1)
  encaissementRate!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(1)
  decaissementRate!: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}