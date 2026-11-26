import { randomBytes } from "node:crypto";
import { argon2id, argon2Verify } from "hash-wasm";

export const ARGON2ID_PARAMS = {
  parallelism: 1,
  iterations: 3,
  memorySize: 65536,
  hashLength: 32,
} as const;

/** Hash encodé d'un secret fictif — comparaison à durée constante si l'e-mail est inconnu. */
export const DUMMY_ARGON2_HASH =
  "$argon2id$v=19$m=65536,t=3,p=1$njKEH/1ZZ8ZztWMxSRS24Q$x1tos8JxYq6+D+339Rr1qOcody7e6tQkkGNBK6U8tM8";

export async function hashPassword(password: string): Promise<string> {
  return argon2id({
    password,
    salt: randomBytes(16),
    parallelism: ARGON2ID_PARAMS.parallelism,
    iterations: ARGON2ID_PARAMS.iterations,
    memorySize: ARGON2ID_PARAMS.memorySize,
    hashLength: ARGON2ID_PARAMS.hashLength,
    outputType: "encoded",
  });
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  try {
    return await argon2Verify({ password, hash: encodedHash });
  } catch {
    return false;
  }
}
