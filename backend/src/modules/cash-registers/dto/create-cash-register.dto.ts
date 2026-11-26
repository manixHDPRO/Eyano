import { Transform } from "class-transformer";
import { IsBoolean, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from "class-validator";

export class CreateCashRegisterDto {
  @IsUUID(undefined, { message: "L'identifiant boutique est invalide." })
  storeId!: string;

  @Transform(({ value }) => (typeof value === "string" ? value.trim().toUpperCase() : value))
  @IsString()
  @Matches(/^[A-Z0-9][A-Z0-9-]{0,15}$/, {
    message: "Le code caisse doit contenir 1 à 16 caractères (A-Z, 0-9, tiret).",
  })
  code!: string;

  @IsString()
  @MinLength(2, { message: "Le nom de la caisse doit contenir au moins 2 caractères." })
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
