import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class UpdateGoodsReceiptDto {
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}