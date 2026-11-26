import { apiRequest } from "./client";

export type SettingValueType = "STRING" | "NUMBER" | "BOOLEAN" | "JSON";

export type AppSettingItem = {
  key: string;
  group: string;
  value: unknown;
  valueType: SettingValueType;
  isCritical: boolean;
  description: string | null;
  readOnly: boolean;
};

export type BackupStatusSnapshot = {
  lastSuccessAt: string | null;
  lastFile: string | null;
  stale: boolean;
};

export type SettingsResponse = {
  items: AppSettingItem[];
  saleNumberPrefix: string;
  backup: BackupStatusSnapshot | null;
};

export function fetchSettings(): Promise<SettingsResponse> {
  return apiRequest("/settings");
}

export type SettingUpdate = {
  key: string;
  value: unknown;
};

export function updateSettings(updates: SettingUpdate[]): Promise<SettingsResponse> {
  return apiRequest("/settings", {
    method: "PATCH",
    body: JSON.stringify({ updates }),
  });
}