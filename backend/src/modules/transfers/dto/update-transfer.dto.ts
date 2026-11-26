import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class UpdateTransferDto {
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
