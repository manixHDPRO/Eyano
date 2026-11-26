import { IsInt, IsString, IsUUID, MaxLength, Min } from "class-validator";

export class CentralWarehouseAdjustDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(0)
  newQuantity!: number;

  @IsString()
  @MaxLength(500)
  notes!: string;
}