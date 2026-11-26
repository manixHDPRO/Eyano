import { ReferentialStatus } from "@prisma/client";
import { Transform } from "class-transformer";
import { IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class UpdateStoreDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toUpperCase() : value))
  @IsString()
  @Matches(/^[A-Z0-9][A-Z0-9-]{0,15}$/, {
    message: "Le code boutique doit contenir 1 à 16 caractères (A-Z, 0-9, tiret).",
  })
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  address?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string | null;

  @IsOptional()
  @IsEnum(ReferentialStatus)
  status?: ReferentialStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  receiptHeader?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  receiptFooter?: string | null;
}
