export const STOCK_SOURCE_TYPE = {
  GOODS_RECEIPT: "goods_receipt",
  MANUAL_ADJUSTMENT: "manual_adjustment",
  TRANSFER: "transfer",
  INVENTORY: "inventory",
  INTERNAL_ISSUE: "internal_stock_issue",
  SALE: "sale",
} as const;

export const SETTING_STOCK_ALERT_DEFAULT = "stock.alert_threshold_default";
export const SETTING_NOTIFY_LOW_STOCK = "notifications.LOW_STOCK";
export const SETTING_NOTIFY_STOCKOUT = "notifications.STOCKOUT";
export const SETTING_ALLOW_MANUAL_ADJUSTMENT = "stock.allow_manual_adjustment";

export const STOCK_MOVEMENTS_ERROR = {
  INVALID_QUANTITY: "STOCK_INVALID_QUANTITY",
  WAREHOUSE_REQUIRED: "STOCK_WAREHOUSE_REQUIRED",
  STORE_REQUIRED: "STOCK_STORE_REQUIRED",
  LOCATION_EXCLUSIVE: "STOCK_LOCATION_EXCLUSIVE",
  INSUFFICIENT_STOCK: "INSUFFICIENT_STOCK",
  MANUAL_ADJUSTMENT_DISABLED: "STOCK_MANUAL_ADJUSTMENT_DISABLED",
} as const;

export const STOCK_QUERY_ERROR = {
  FORBIDDEN_SCOPE: "STOCK_FORBIDDEN_SCOPE",
  RECONCILE_FORBIDDEN: "STOCK_RECONCILE_FORBIDDEN",
} as const;

export const STOCK_AUDIT = {
  RECONCILE: "stock.reconcile",
} as const;

export const STOCK_AUDIT_ENTITY = {
  STOCK_LEVEL: "StockLevel",
} as const;

export type StockAlertStatus = "OK" | "LOW" | "STOCKOUT";