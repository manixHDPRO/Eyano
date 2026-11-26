import type { LiveSyncQueryRoot } from "./live-sync.types";

const SKIP_RESOURCES = new Set(["auth", "health", "audit-logs", "permissions", "access-demo"]);

const STOCK_KEYS: LiveSyncQueryRoot[] = [
  "stock",
  "stock-summary",
  "stock-levels",
  "stock-movements",
  "admin-dashboard",
  "pos-catalog",
];

const NOTIFY_KEYS: LiveSyncQueryRoot[] = ["notifications", "notification-unread"];

function uniq(values: LiveSyncQueryRoot[]): LiveSyncQueryRoot[] {
  return [...new Set(values)];
}

/** Déduit les clés React Query à invalider après une mutation HTTP. */
export function queryKeysForMutationPath(path: string): LiveSyncQueryRoot[] | null {
  const stripped = path.replace(/\?.*$/, "").replace(/\/+$/, "");
  const relative = stripped.startsWith("/api/v1") ? stripped.slice("/api/v1".length) : stripped;
  const segments = relative.split("/").filter(Boolean);
  const resource = segments[0];
  if (!resource || SKIP_RESOURCES.has(resource)) {
    return null;
  }

  switch (resource) {
    case "transfers":
      return uniq([
        "transfers",
        "transfer",
        ...STOCK_KEYS,
        ...NOTIFY_KEYS,
        "pos-workspace",
        "reports-overview",
      ]);
    case "stock":
    case "stock-movements":
      return uniq([...STOCK_KEYS, "transfers", "reports-overview"]);
    case "goods-receipts":
      return uniq([
        "goods-receipts",
        "goods-receipt",
        ...STOCK_KEYS,
        "suppliers",
        "products",
        "admin-dashboard",
      ]);
    case "products":
    case "categories":
    case "barcodes":
      return uniq([
        "products",
        "product",
        "categories",
        "pos-catalog",
        "pricing",
        "admin-dashboard",
        ...STOCK_KEYS,
      ]);
    case "pricing":
    case "discounts":
      return uniq(["pricing", "products", "product", "pos-catalog", "admin-dashboard"]);
    case "internal-issues":
      return uniq([
        "internal-issues",
        "internal-issue",
        "internal-issues-pending-store",
        ...STOCK_KEYS,
        ...NOTIFY_KEYS,
        "admin-dashboard",
      ]);
    case "inventories":
      return uniq(["inventories", "inventory-session", ...STOCK_KEYS, "admin-dashboard"]);
    case "sales":
      return uniq([
        "sales",
        "sale",
        "pos-recent-sales",
        "pos-store-history",
        "cash-session",
        "admin-dashboard",
        "reports-overview",
        ...STOCK_KEYS,
      ]);
    case "cash-sessions":
      return uniq(["cash-session", "pos-workspace", "pos-recent-sales", "admin-dashboard", "reports-overview"]);
    case "cash-registers":
      return uniq(["cash-registers", "expense-cash-registers", "pos-workspace"]);
    case "expenses":
      return uniq([
        "expenses",
        "expenses-summary",
        "expenses-pending-cashier",
        "expense-locations",
        "cash-session",
        ...NOTIFY_KEYS,
        "admin-dashboard",
        "reports-overview",
      ]);
    case "payments":
      return uniq(["payments", "sales", "cash-session", "reports-overview"]);
    case "notifications":
      return uniq([...NOTIFY_KEYS, "notifications"]);
    case "exchange-rates":
      return uniq(["exchange-rates", "exchange-rates-current", "admin-dashboard", "pos-catalog"]);
    case "settings":
      return uniq(["settings", "health"]);
    case "stores":
    case "warehouses":
      return uniq(["stores", "store", "warehouses", "pos-workspace", "admin-dashboard"]);
    case "suppliers":
      return uniq(["suppliers", "supplier", "goods-receipts"]);
    case "users":
    case "roles":
      return uniq(["users", "user", "roles", "role"]);
    case "login-histories":
      return uniq(["login-histories", "login-histories-summary"]);
    case "reports":
      return uniq(["reports-overview", "reports-top-products", "admin-dashboard"]);
    case "dashboard":
      return uniq(["admin-dashboard"]);
    case "pos":
      return uniq(["pos-workspace", "pos-catalog", "pos-recent-sales", "pos-store-history"]);
    default:
      return uniq(["admin-dashboard"]);
  }
}