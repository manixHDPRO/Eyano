import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class UpdateProductDiscountDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  percent!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}