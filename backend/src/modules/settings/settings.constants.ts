export const SETTINGS_ERROR = {
  UNKNOWN_KEY: "SETTINGS_UNKNOWN_KEY",
  FORBIDDEN_CRITICAL: "SETTINGS_FORBIDDEN_CRITICAL",
  READ_ONLY: "SETTINGS_READ_ONLY",
  INVALID_VALUE: "SETTINGS_INVALID_VALUE",
} as const;

/** Clés non modifiables (invariants métier). */
export const SETTING_READ_ONLY_KEYS = new Set<string>(["stock.block_when_insufficient"]);

export const SETTINGS_GROUP_ORDER = [
  "commercial",
  "stock",
  "security",
  "cash",
  "notifications",
  "technical",
] as const;