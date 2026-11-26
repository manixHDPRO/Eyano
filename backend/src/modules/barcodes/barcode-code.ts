import { randomInt } from "node:crypto";

export const BARCODE_PREFIX = "EY";
export const BARCODE_DIGIT_LENGTH = 6;
export const BARCODE_PATTERN = /^EY[0-9]{6}$/;

const CODE128_B_MIN = 32;
const CODE128_B_MAX = 126;

export function isCode128BCompatible(value: string): boolean {
  if (value.length < 1 || value.length > 48) {
    return false;
  }
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code < CODE128_B_MIN || code > CODE128_B_MAX) {
      return false;
    }
  }
  return true;
}

export function generateBarcodePayload(): string {
  let digits = "";
  for (let index = 0; index < BARCODE_DIGIT_LENGTH; index += 1) {
    digits += String(randomInt(0, 10));
  }
  return `${BARCODE_PREFIX}${digits}`;
}

/** Retire espaces et caractères de contrôle fréquents chez les lecteurs USB (GS, CR, LF, etc.). */
export function normalizeBarcodeCode(raw: string): string {
  return raw
    .replace(/[\u0000-\u001F\u007F]+/g, "")
    .trim()
    .toUpperCase();
}

export function isGeneratedBarcodeFormat(code: string): boolean {
  return BARCODE_PATTERN.test(code);
}
