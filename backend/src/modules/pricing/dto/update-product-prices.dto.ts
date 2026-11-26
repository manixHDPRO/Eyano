import { IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class UpdateProductPricesDto {
  @IsNumber()
  @Min(0)
  purchasePrice!: number;

  @IsNumber()
  @Min(0)
  officialPrice!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}