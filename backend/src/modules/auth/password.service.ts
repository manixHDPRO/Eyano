import { Injectable } from "@nestjs/common";
import { DUMMY_ARGON2_HASH, hashPassword, verifyPassword } from "../../common/crypto/argon2";

@Injectable()
export class PasswordService {
  hash(password: string): Promise<string> {
    return hashPassword(password);
  }

  verify(password: string, encodedHash: string): Promise<boolean> {
    return verifyPassword(password, encodedHash);
  }

  /** Compare contre un hash fictif pour limiter l'oracle de timing si l'e-mail est inconnu. */
  verifyDummy(password: string): Promise<boolean> {
    return verifyPassword(password, DUMMY_ARGON2_HASH);
  }
}
