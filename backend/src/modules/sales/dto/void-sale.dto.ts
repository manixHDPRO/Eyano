import { IsString, MaxLength, MinLength } from "class-validator";

export class VoidSaleDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}