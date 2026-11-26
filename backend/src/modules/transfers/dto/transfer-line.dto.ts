import { Type } from "class-transformer";
import { IsInt, IsUUID, Min } from "class-validator";

export class TransferLineDto {
  @IsUUID()
  productId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantityRequested!: number;
}
