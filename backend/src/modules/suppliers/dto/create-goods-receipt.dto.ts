import { Type } from "class-transformer";
import { IsArray, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from "class-validator";
import { GoodsReceiptLineDto } from "./goods-receipt-line.dto";

export class CreateGoodsReceiptDto {
  @IsUUID()
  supplierId!: string;

  @IsUUID()
  warehouseId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GoodsReceiptLineDto)
  items?: GoodsReceiptLineDto[];
}