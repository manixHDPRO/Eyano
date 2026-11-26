import { MovementDirection } from "@prisma/client";
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from "class-validator";

export class ManualAdjustmentDto {
  @IsUUID()
  productId!: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsEnum(MovementDirection)
  direction!: MovementDirection;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsString()
  @MaxLength(500)
  note!: string;
}