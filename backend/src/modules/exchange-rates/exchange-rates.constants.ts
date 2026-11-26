export const EXCHANGE_RATES_ERROR = {
  NOT_FOUND: "EXCHANGE_RATE_NOT_FOUND",
  INVALID_RATE: "EXCHANGE_RATE_INVALID",
  NO_OPEN_RATE: "EXCHANGE_RATE_NO_OPEN",
} as const;

export const EXCHANGE_RATES_AUDIT = {
  UPDATED: "exchange_rate.updated",
} as const;

export const SETTING_NOTIFY_RATE = "notifications.RATE_CHANGED";