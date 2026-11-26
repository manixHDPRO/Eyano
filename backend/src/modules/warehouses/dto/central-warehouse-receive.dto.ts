import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from "class-validator";

export class CentralWarehouseReceiveDto {
  @IsUUID()
  productId!: string;

  @IsUUID()
  supplierId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}