import { Type } from "class-transformer";
import { IsInt, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from "class-validator";

export class GoodsReceiptLineDto {
  @IsUUID()
  productId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitCost!: number;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  note?: string;
}