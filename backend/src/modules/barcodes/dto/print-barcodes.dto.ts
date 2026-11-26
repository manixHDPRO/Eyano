import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";
import { BARCODE_PRINT_COPIES_MAX, BARCODE_PRINT_PRODUCTS_MAX } from "../barcodes.constants";

export class PrintBarcodesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BARCODE_PRINT_PRODUCTS_MAX)
  @IsUUID(undefined, { each: true })
  productIds!: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(BARCODE_PRINT_COPIES_MAX)
  copies = 1;
}
