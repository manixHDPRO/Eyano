const CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{0,15}$/;

export function normalizeReferentialCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidReferentialCode(code: string): boolean {
  return CODE_PATTERN.test(code);
}

export function emptyToNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isPrismaUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "P2002";
}
