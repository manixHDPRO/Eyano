import type { AppSettingItem } from "../../lib/api/settings";

export const SETTINGS_GROUP_TITLES: Record<string, string> = {
  commercial: "Paramètres commerciaux & tickets",
  stock: "Paramètres de stock & alertes",
  security: "Paramètres de sécurité",
  cash: "Paramètres de caisse",
  notifications: "Paramètres de notifications",
  technical: "Paramètres généraux & techniques",
};

export const SETTINGS_GROUP_ORDER = [
  "commercial",
  "stock",
  "security",
  "cash",
  "notifications",
  "technical",
] as const;

/** Ordre d’affichage privilégié (modèle HD-Eyano + capture). */
export const PREFERRED_SETTING_KEYS: Record<string, readonly string[]> = {
  commercial: [
    "commercial.primary_currency",
    "commercial.accepted_currencies",
    "commercial.receipt",
    "commercial.payment_methods",
    "commercial.rounding_mode",
    "commercial.rounding_scale_usd",
    "commercial.rounding_scale_cdf",
  ],
  stock: [
    "stock.alert_threshold_default",
    "stock.block_when_insufficient",
    "stock.transfer_requires_validation",
    "stock.internal_issue_requires_approval",
    "stock.inventory_requires_justification",
    "stock.allow_manual_adjustment",
  ],
  security: [
    "security.password_min_length",
    "security.password_requires_mixed",
    "security.session_access_ttl_min",
    "security.session_refresh_ttl_hours",
    "security.max_failed_logins",
    "security.lock_minutes",
  ],
  cash: ["cash.force_close_after_hours"],
  notifications: [
    "notifications.LOW_STOCK",
    "notifications.STOCKOUT",
    "notifications.TRANSFER_PENDING",
    "notifications.TRANSFER_SHIPPED",
    "notifications.TRANSFER_RECEIVED",
    "notifications.INVENTORY_VARIANCE",
    "notifications.CASH_VARIANCE",
    "notifications.INTERNAL_ISSUE_PENDING",
    "notifications.EXPENSE_DRAWER_PENDING",
    "notifications.PRICE_CHANGED",
    "notifications.DISCOUNT_CHANGED",
    "notifications.RATE_CHANGED",
  ],
  technical: [
    "company.legal_name",
    "company.address",
    "company.phone",
    "company.timezone",
    "company.date_format",
    "company.logo_path",
  ],
};

const FIELD_LABELS: Record<string, string> = {
  "commercial.primary_currency": "Devise principale",
  "commercial.accepted_currencies": "Devises acceptées",
  "commercial.receipt": "Pied de ticket de caisse",
  "stock.alert_threshold_default": "Seuil d'alerte stock par défaut (unités)",
  "stock.block_when_insufficient": "Blocage obligatoire des ventes à stock nul",
  "stock.transfer_requires_validation": "Validation centrale obligatoire pour les transferts",
  "stock.internal_issue_requires_approval": "Validation centrale obligatoire pour sorties internes",
  "notifications.LOW_STOCK": "Alertes automatiques de stock faible",
  "notifications.TRANSFER_PENDING": "Notifications de transferts en attente de validation",
  "notifications.TRANSFER_SHIPPED": "Alerte caisse : transfert expédié à réceptionner",
  "security.session_refresh_ttl_hours": "Durée maximale de session (heures)",
};

export function settingLabel(setting: AppSettingItem): string {
  return FIELD_LABELS[setting.key] ?? setting.description ?? setting.key;
}

export function orderSettingsForDisplay(items: AppSettingItem[]): AppSettingItem[] {
  const byGroup = new Map<string, AppSettingItem[]>();
  for (const item of items) {
    const bucket = byGroup.get(item.group) ?? [];
    bucket.push(item);
    byGroup.set(item.group, bucket);
  }

  const ordered: AppSettingItem[] = [];
  for (const group of SETTINGS_GROUP_ORDER) {
    const bucket = byGroup.get(group);
    if (!bucket?.length) {
      continue;
    }
    const preferred = PREFERRED_SETTING_KEYS[group] ?? [];
    const rank = new Map(preferred.map((key, index) => [key, index]));
    bucket.sort((a, b) => {
      const ra = rank.get(a.key) ?? 999;
      const rb = rank.get(b.key) ?? 999;
      if (ra !== rb) {
        return ra - rb;
      }
      return a.key.localeCompare(b.key);
    });
    ordered.push(...bucket);
  }

  return ordered;
}

export function groupSettings(items: AppSettingItem[]): Map<string, AppSettingItem[]> {
  const ordered = orderSettingsForDisplay(items);
  const map = new Map<string, AppSettingItem[]>();
  for (const item of ordered) {
    const bucket = map.get(item.group) ?? [];
    bucket.push(item);
    map.set(item.group, bucket);
  }
  return map;
}