export const AUTH_SETTING_KEYS = {
  accessTtlMinutes: "security.session_access_ttl_min",
  refreshTtlHours: "security.session_refresh_ttl_hours",
  maxFailedLogins: "security.max_failed_logins",
  lockMinutes: "security.lock_minutes",
} as const;

export const AUTH_ERROR = {
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  ACCOUNT_LOCKED: "ACCOUNT_LOCKED",
  ACCOUNT_INACTIVE: "ACCOUNT_INACTIVE",
  UNAUTHORIZED: "UNAUTHORIZED",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  REFRESH_INVALID: "REFRESH_INVALID",
  REFRESH_REUSE: "REFRESH_REUSE",
  CURRENT_PASSWORD_INVALID: "CURRENT_PASSWORD_INVALID",
} as const;
