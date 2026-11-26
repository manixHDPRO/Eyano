export const PRODUCTS_ERROR = {
  NOT_FOUND: "PRODUCT_NOT_FOUND",
  REFERENCE_TAKEN: "PRODUCT_REFERENCE_TAKEN",
  INVALID_REFERENCE: "PRODUCT_INVALID_REFERENCE",
  CATEGORY_NOT_LEAF: "PRODUCT_CATEGORY_NOT_LEAF",
  CATEGORY_ARCHIVED: "PRODUCT_CATEGORY_ARCHIVED",
  CATEGORY_REQUIRED: "PRODUCT_CATEGORY_REQUIRED",
  INVALID_STATUS: "PRODUCT_INVALID_STATUS",
  PHOTO_REQUIRED: "PRODUCT_PHOTO_REQUIRED",
  PHOTO_INVALID: "PRODUCT_PHOTO_INVALID",
  PHOTO_TOO_LARGE: "PRODUCT_PHOTO_TOO_LARGE",
  IN_USE: "PRODUCT_IN_USE",
  STORE_NOT_FOUND: "PRODUCT_STORE_NOT_FOUND",
  STORE_INACTIVE: "PRODUCT_STORE_INACTIVE",
} as const;

export const PRODUCT_REFERENCE_PATTERN = /^[A-Z0-9][A-Z0-9-]{1,31}$/;
export const PRODUCT_PHOTO_MAX_BYTES = 2 * 1024 * 1024;
export const PRODUCT_PHOTO_MIME = ["image/jpeg", "image/png", "image/webp"] as const;

export function normalizeProductReference(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "-");
}

export function isValidProductReference(reference: string): boolean {
  return PRODUCT_REFERENCE_PATTERN.test(reference);
}

export { computeFinalPrice, moneyString } from "../../common/money";
