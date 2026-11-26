import { Transform } from "class-transformer";
import { IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class CreateStoreDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toUpperCase() : value))
  @IsString()
  @Matches(/^[A-Z0-9][A-Z0-9-]{0,15}$/, {
    message: "Le code boutique doit contenir 1 à 16 caractères (A-Z, 0-9, tiret).",
  })
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  receiptHeader?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  receiptFooter?: string;
}
