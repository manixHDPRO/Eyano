import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Alert } from "../../components/ui/Alert";
import { modalFieldClassName } from "../../components/ui/form-styles";
import { useToast } from "../../components/ui/Toast";
import { formatApiErrorMessage } from "../../lib/api/errors";
import type { AppSettingItem, BackupStatusSnapshot } from "../../lib/api/settings";
import { fetchSettings, updateSettings } from "../../lib/api/settings";
import { hasPermission } from "../../lib/auth/permissions";
import { useAuth } from "../auth/AuthProvider";
import {
  SETTINGS_GROUP_ORDER,
  SETTINGS_GROUP_TITLES,
  groupSettings,
  settingLabel,
} from "./app-settings-display";
import { apiValueToFormValue, buildInitialFormValues, formValueToApiValue, isSettingVisibleInForm } from "./app-settings-form";

export function AppSettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [values, setValues] = useState<Record<string, string>>({});

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
  });

  const items = settingsQuery.data?.items ?? [];
  const salePrefix = settingsQuery.data?.saleNumberPrefix ?? "VE";
  const backup = settingsQuery.data?.backup ?? null;

  useEffect(() => {
    if (items.length === 0) {
      return;
    }
    setValues(buildInitialFormValues(items));
  }, [items]);

  const grouped = useMemo(() => groupSettings(items), [items]);

  const canManage = Boolean(
    user && (hasPermission(user, "settings.update") || hasPermission(user, "settings.update_critical")),
  );

  const saveMutation = useMutation({
    mutationFn: () => {
      const updates = collectSettingUpdates(items, values, user);
      if (updates.length === 0) {
        return Promise.reject(new Error("Aucune modification à enregistrer."));
      }
      return updateSettings(updates);
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
      setValues(buildInitialFormValues(data.items));
      pushToast({
        tone: "success",
        message: "Paramètres enregistrés et tracés dans le journal d'audit.",
      });
    },
    onError: (caught) => {
      pushToast({ tone: "error", message: formatApiErrorMessage(caught, "Erreur lors de l'enregistrement des paramètres.") });
    },
  });

  const errorMessage = settingsQuery.isError
    ? formatApiErrorMessage(settingsQuery.error, "Chargement des paramètres impossible.")
    : null;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canManage) {
      return;
    }
    void saveMutation.mutateAsync();
  }

  return (
    <div className="space-y-4">
      {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}

      {settingsQuery.isLoading ? (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500">
          Chargement des paramètres…
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-6 rounded-xl border border-slate-200 bg-white p-6">
          <BackupStatusPanel backup={backup} />
          {SETTINGS_GROUP_ORDER.map((groupId) => {
            const groupItems = grouped.get(groupId)?.filter(isSettingVisibleInForm) ?? [];
            if (groupItems.length === 0 && groupId !== "commercial") {
              return null;
            }

            const title = SETTINGS_GROUP_TITLES[groupId] ?? groupId;

            return (
              <section key={groupId} className="space-y-3 border-b border-slate-100 pb-5 last:border-b-0">
                <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
                <div className="grid grid-cols-1 gap-4 text-xs md:grid-cols-2">
                  {groupId === "commercial" ? (
                    <Field
                      label="Préfixe numérotation des ventes"
                      disabled
                      value={salePrefix}
                      onChange={() => undefined}
                    />
                  ) : null}
                  {groupItems.map((setting) => (
                    <SettingField
                      key={setting.key}
                      setting={setting}
                      value={values[setting.key] ?? ""}
                      disabled={!isFieldEditable(setting, user)}
                      onChange={(next) => setValues((current) => ({ ...current, [setting.key]: next }))}
                    />
                  ))}
                </div>
              </section>
            );
          })}

          {canManage ? (
            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="rounded-lg bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
              >
                {saveMutation.isPending ? "Enregistrement…" : "Enregistrer les paramètres"}
              </button>
            </div>
          ) : null}
        </form>
      )}
    </div>
  );
}

function SettingField({
  setting,
  value,
  disabled,
  onChange,
}: {
  setting: AppSettingItem;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const label = settingLabel(setting);

  if (setting.valueType === "BOOLEAN") {
    return (
      <Field label={label} disabled={disabled} value={value} onChange={onChange} kind="boolean" />
    );
  }

  if (setting.valueType === "NUMBER") {
    return (
      <Field label={label} disabled={disabled} value={value} onChange={onChange} kind="number" />
    );
  }

  if (setting.key === "commercial.receipt") {
    return <Field label={label} disabled={disabled} value={value} onChange={onChange} kind="text" />;
  }

  if (setting.valueType === "JSON") {
    return (
      <div className="md:col-span-2">
        <Field label={label} disabled={disabled} value={value} onChange={onChange} kind="textarea" />
      </div>
    );
  }

  return <Field label={label} disabled={disabled} value={value} onChange={onChange} kind="text" />;
}

function Field({
  label,
  value,
  disabled,
  onChange,
  kind = "text",
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  kind?: "text" | "number" | "boolean" | "textarea";
}) {
  return (
    <label className="block">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {kind === "boolean" ? (
        <select
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${modalFieldClassName} disabled:bg-slate-100`}
        >
          <option value="true">Activé</option>
          <option value="false">Désactivé</option>
        </select>
      ) : kind === "textarea" ? (
        <textarea
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${modalFieldClassName} min-h-20 resize-y disabled:bg-slate-100`}
        />
      ) : (
        <input
          type={kind === "number" ? "number" : "text"}
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${modalFieldClassName} disabled:bg-slate-100`}
        />
      )}
    </label>
  );
}

function BackupStatusPanel({ backup }: { backup: BackupStatusSnapshot | null }) {
  if (!backup) {
    return (
      <section className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        Sauvegarde PostgreSQL : état non disponible (définir <code className="font-mono">BACKUP_STATUS_FILE</code> sur le
        serveur après configuration du cron).
      </section>
    );
  }

  const tone = backup.stale ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-900";

  return (
    <section className={`rounded-lg border px-4 py-3 text-xs ${tone}`}>
      <p className="font-semibold">Dernière sauvegarde PostgreSQL</p>
      <p className="mt-1">
        {backup.lastSuccessAt
          ? new Date(backup.lastSuccessAt).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })
          : "—"}
        {backup.lastFile ? ` · ${backup.lastFile}` : ""}
      </p>
      {backup.stale ? (
        <p className="mt-1 text-amber-800">Alerte : aucune sauvegarde récente (plus de 36 h).</p>
      ) : null}
    </section>
  );
}

function collectSettingUpdates(
  items: AppSettingItem[],
  formValues: Record<string, string>,
  user: ReturnType<typeof useAuth>["user"],
): { key: string; value: unknown }[] {
  const updates: { key: string; value: unknown }[] = [];
  for (const item of items) {
    if (!isFieldEditable(item, user)) {
      continue;
    }
    const nextRaw = formValues[item.key];
    if (nextRaw === undefined) {
      continue;
    }
    const previousRaw = apiValueToFormValue(item);
    if (nextRaw === previousRaw) {
      continue;
    }
    updates.push({ key: item.key, value: formValueToApiValue(item, nextRaw) });
  }
  return updates;
}

function isFieldEditable(setting: AppSettingItem, user: ReturnType<typeof useAuth>["user"]): boolean {
  if (!user || setting.readOnly) {
    return false;
  }
  if (setting.isCritical) {
    return hasPermission(user, "settings.update_critical");
  }
  return hasPermission(user, "settings.update");
}