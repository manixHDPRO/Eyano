import { IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateInventoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}