import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from "class-validator";

export class InventoryItemPatchDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(0)
  physicalQty!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  justification?: string | null;
}

export class PatchInventoryItemsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InventoryItemPatchDto)
  items!: InventoryItemPatchDto[];
}