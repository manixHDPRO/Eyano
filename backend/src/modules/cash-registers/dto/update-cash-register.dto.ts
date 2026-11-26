import { ReferentialStatus } from "@prisma/client";
import { Transform } from "class-transformer";
import { IsBoolean, IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class UpdateCashRegisterDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toUpperCase() : value))
  @IsString()
  @Matches(/^[A-Z0-9][A-Z0-9-]{0,15}$/, {
    message: "Le code caisse doit contenir 1 à 16 caractères (A-Z, 0-9, tiret).",
  })
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsEnum(ReferentialStatus)
  status?: ReferentialStatus;
}
