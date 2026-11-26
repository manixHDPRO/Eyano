import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsInt, IsUUID, Max, Min, ValidateNested } from "class-validator";
import { CreateSalePaymentDto } from "../../payments/dto/create-sale-payment.dto";

export class CreateSaleLineDto {
  @IsUUID()
  productId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9_999)
  quantity!: number;
}

export class CreateSaleDto {
  @IsUUID()
  cashSessionId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleLineDto)
  items!: CreateSaleLineDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSalePaymentDto)
  payments!: CreateSalePaymentDto[];
}