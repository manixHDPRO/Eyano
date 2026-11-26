import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator";

export class ReceiveTransferLineDto {
  @ValidateIf((line: ReceiveTransferLineDto) => !line.productId)
  @IsUUID()
  transferItemId?: string;

  @ValidateIf((line: ReceiveTransferLineDto) => !line.transferItemId)
  @IsUUID()
  productId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantityReceived!: number;
}

export class ReceiveTransferDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiveTransferLineDto)
  items!: ReceiveTransferLineDto[];

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  complete?: boolean;
}
