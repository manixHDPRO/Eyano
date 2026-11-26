import { existsSync, readFileSync } from "node:fs";

export type BackupStatusSnapshot = {
  lastSuccessAt: string | null;
  lastFile: string | null;
  stale: boolean;
};

const STALE_AFTER_MS = 36 * 60 * 60 * 1000;

type BackupStatusFile = {
  lastSuccessAt?: string;
  lastFile?: string;
};

export function readBackupStatus(filePath: string | undefined): BackupStatusSnapshot | null {
  const trimmed = filePath?.trim();
  if (!trimmed || !existsSync(trimmed)) {
    return null;
  }

  try {
    const raw = readFileSync(trimmed, "utf8");
    const parsed = JSON.parse(raw) as BackupStatusFile;
    const lastSuccessAt = typeof parsed.lastSuccessAt === "string" ? parsed.lastSuccessAt : null;
    const lastFile = typeof parsed.lastFile === "string" ? parsed.lastFile : null;
    let stale = true;
    if (lastSuccessAt) {
      const age = Date.now() - new Date(lastSuccessAt).getTime();
      stale = !Number.isFinite(age) || age > STALE_AFTER_MS;
    }
    return { lastSuccessAt, lastFile, stale };
  } catch {
    return null;
  }
}