import { mkdirSync } from "node:fs";
import { join } from "node:path";

export function resolveUploadRoot(configured?: string): string {
  const trimmed = configured?.trim();
  if (trimmed && trimmed.length > 0) {
    return trimmed;
  }
  return join(process.cwd(), "uploads");
}

export function ensureUploadDirectories(root: string): void {
  mkdirSync(join(root, "products"), { recursive: true });
  mkdirSync(join(root, "expenses"), { recursive: true });
}
