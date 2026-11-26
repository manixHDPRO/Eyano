import { Type } from "class-transformer";
import { IsArray, IsInt, IsOptional, IsUUID, Min, ValidateNested } from "class-validator";

export class ShipTransferLineDto {
  @IsUUID()
  productId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantityShipped!: number;
}

export class ShipTransferDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShipTransferLineDto)
  items?: ShipTransferLineDto[];
}
