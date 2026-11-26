import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class LoginDto {
  @IsEmail({}, { message: "Adresse e-mail invalide." })
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(1, { message: "Mot de passe requis." })
  @MaxLength(200)
  password!: string;
}
