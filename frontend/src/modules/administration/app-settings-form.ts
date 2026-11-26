import type { AppSettingItem } from "../../lib/api/settings";

export function formValueToApiValue(setting: AppSettingItem, raw: string): unknown {
  switch (setting.key) {
    case "commercial.accepted_currencies":
      return raw
        .split(",")
        .map((part) => part.trim().toUpperCase())
        .filter(Boolean);
    case "commercial.receipt": {
      const current = isRecord(setting.value) ? { ...setting.value } : {};
      return { ...current, footer: raw };
    }
    default:
      break;
  }

  switch (setting.valueType) {
    case "BOOLEAN":
      return raw === "true";
    case "NUMBER":
      return Number(raw);
    case "JSON":
      return JSON.parse(raw);
    default:
      return raw;
  }
}

export function apiValueToFormValue(setting: AppSettingItem): string {
  switch (setting.key) {
    case "commercial.accepted_currencies":
      if (Array.isArray(setting.value)) {
        return setting.value.join(",");
      }
      return "";
    case "commercial.receipt":
      if (isRecord(setting.value) && typeof setting.value.footer === "string") {
        return setting.value.footer;
      }
      return "";
    default:
      break;
  }

  switch (setting.valueType) {
    case "BOOLEAN":
      return setting.value === true ? "true" : "false";
    case "NUMBER":
      return setting.value === null || setting.value === undefined ? "" : String(setting.value);
    case "JSON":
      return JSON.stringify(setting.value ?? {}, null, 0);
    default:
      return setting.value === null || setting.value === undefined ? "" : String(setting.value);
  }
}

export function buildInitialFormValues(items: AppSettingItem[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const item of items) {
    map[item.key] = apiValueToFormValue(item);
  }
  return map;
}

export function isSettingVisibleInForm(setting: AppSettingItem): boolean {
  if (setting.key === "company.logo_path") {
    return false;
  }
  if (
    setting.group === "commercial" &&
    setting.key.startsWith("commercial.rounding") &&
    setting.key !== "commercial.rounding_mode"
  ) {
    return false;
  }
  if (setting.key === "commercial.payment_methods") {
    return false;
  }
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}