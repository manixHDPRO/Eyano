import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class LookupBarcodeQueryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  code!: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;
}
