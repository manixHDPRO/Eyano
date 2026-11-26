import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class PosCatalogQueryDto {
  @IsUUID()
  storeId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;
}