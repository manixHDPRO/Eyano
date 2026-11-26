import { createHash } from "node:crypto";

const MAX_KEY_LENGTH = 128;

export function hashIdempotencyKey(raw: string): string {
  const normalized = raw.trim();
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

export function assertIdempotencyKeyFormat(raw: string | undefined): string {
  const key = raw?.trim();
  if (!key) {
    throw new Error("IDEMPOTENCY_MISSING");
  }
  if (key.length > MAX_KEY_LENGTH) {
    throw new Error("IDEMPOTENCY_TOO_LONG");
  }
  return key;
}