import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, ValidateNested } from "class-validator";
import { GoodsReceiptLineDto } from "./goods-receipt-line.dto";

export class SetGoodsReceiptItemsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GoodsReceiptLineDto)
  items!: GoodsReceiptLineDto[];
}