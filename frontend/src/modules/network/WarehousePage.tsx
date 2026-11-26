import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { StatusBadge } from "../../components/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import {
  FormField,
  FormSection,
  compactInputClassName,
  compactTextareaClassName,
} from "../../components/ui/FormField";
import { useToast } from "../../components/ui/Toast";
import { fetchCentralWarehouseDashboard } from "../../lib/api/central-warehouse";
import { formatApiErrorMessage } from "../../lib/api/errors";
import { fetchWarehouses, updateWarehouse } from "../../lib/api/warehouses";
import type { ReferentialStatus, WarehouseDetail } from "../../lib/api/types";
import { hasPermission } from "../../lib/auth/permissions";
import { formatUsd } from "../catalog/money";
import { useAuth } from "../auth/AuthProvider";
import { usePermission } from "../auth/usePermission";
import { referentialStatusLabel, referentialStatusTone } from "./referential-status";

export function WarehousePage() {
  const { user } = useAuth();
  const canManage = usePermission("stores.manage");
  const canStock = Boolean(user && hasPermission(user, "stock.read"));
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const warehouseQuery = useQuery({
    queryKey: ["warehouses"],
    queryFn: fetchWarehouses,
  });

  const dashboardQuery = useQuery({
    queryKey: ["central-warehouse"],
    queryFn: fetchCentralWarehouseDashboard,
    enabled: canStock,
  });

  const warehouse = warehouseQuery.data?.items[0];
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<ReferentialStatus>("ACTIVE");

  useEffect(() => {
    if (!warehouse) {
      return;
    }
    setName(warehouse.name);
    setAddress(warehouse.address ?? "");
    setStatus(warehouse.status);
  }, [warehouse]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateWarehouse(warehouse!.id, {
        name,
        address: address.trim() || null,
        status,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      await queryClient.invalidateQueries({ queryKey: ["central-warehouse"] });
      pushToast({ tone: "success", message: "Fiche entrepôt enregistrée." });
    },
    onError: (caught) => {
      pushToast({
        tone: "error",
        message: formatApiErrorMessage(caught, "Enregistrement impossible."),
      });
    },
  });

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!warehouse || !canManage) {
      return;
    }
    await saveMutation.mutateAsync();
  }

  const errorMessage = warehouseQuery.isError
    ? formatApiErrorMessage(warehouseQuery.error, "Chargement impossible.")
    : null;

  const updatedLabel = useMemo(() => {
    if (!warehouse) {
      return null;
    }
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(warehouse.updatedAt),
    );
  }, [warehouse]);

  const dashboard = dashboardQuery.data;
  const showOpsKpis = canStock && dashboard && !dashboardQuery.isError;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Entrepôt</h2>
        <p className="mt-0.5 max-w-2xl text-sm leading-relaxed text-slate-500">
          Nœud logistique unique du réseau — référentiel pour réceptions, transferts boutique et valorisation des stocks.
        </p>
      </div>

      {showOpsKpis ? (
        <section className="grid gap-3 sm:grid-cols-3">
          <Kpi label="Unités en main" value={formatQty(dashboard.totalUnits)} hint="Stock entrepôt" />
          <Kpi label="Valorisation" value={formatUsd(dashboard.totalValuationUsd)} hint="Prix d’achat" />
          <Kpi
            label="Alertes stock"
            value={String(dashboard.lowStockCount)}
            hint={dashboard.lowStockCount > 0 ? "Sous seuil ou rupture" : "Situation normale"}
            tone={dashboard.lowStockCount > 0 ? "warning" : "neutral"}
          />
        </section>
      ) : null}

      {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}

      {warehouseQuery.isLoading ? (
        <p className="text-sm text-slate-500">Chargement de la fiche…</p>
      ) : !warehouse ? (
        <Alert tone="error">Aucun entrepôt n’est encore seedé. Relancez le seed structurel.</Alert>
      ) : (
        <WarehouseFormLayout
          warehouse={warehouse}
          name={name}
          address={address}
          status={status}
          canManage={canManage}
          canStock={canStock}
          updatedLabel={updatedLabel}
          pending={saveMutation.isPending}
          onName={setName}
          onAddress={setAddress}
          onStatus={setStatus}
          onSubmit={onSubmit}
        />
      )}
    </div>
  );
}

function WarehouseFormLayout({
  warehouse,
  name,
  address,
  status,
  canManage,
  canStock,
  updatedLabel,
  pending,
  onName,
  onAddress,
  onStatus,
  onSubmit,
}: {
  warehouse: WarehouseDetail;
  name: string;
  address: string;
  status: ReferentialStatus;
  canManage: boolean;
  canStock: boolean;
  updatedLabel: string | null;
  pending: boolean;
  onName: (value: string) => void;
  onAddress: (value: string) => void;
  onStatus: (value: ReferentialStatus) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const inactive = warehouse.status === "INACTIVE";

  return (
    <form className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,18.5rem)] lg:items-start" onSubmit={onSubmit}>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-gradient-to-br from-slate-50 to-white px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-start gap-4">
            <WarehouseMonogram code={warehouse.code} inactive={inactive} />
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold tracking-tight text-slate-900">{warehouse.name}</h3>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs tracking-wide text-slate-500">{warehouse.code}</span>
                <StatusBadge
                  label={referentialStatusLabel(warehouse.status)}
                  tone={referentialStatusTone(warehouse.status)}
                />
              </div>
              {warehouse.address ? <p className="mt-2 text-sm text-slate-600">{warehouse.address}</p> : null}
              {updatedLabel ? (
                <p className="mt-2 text-[11px] text-slate-400">Dernière mise à jour — {updatedLabel}</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-6 px-5 py-6 sm:px-6">
          <FormSection
            title="Identité"
            description={canManage ? "Le code CENTRAL reste figé (référence des mouvements)." : "Consultation — modification réservée aux profils réseau."}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Code" className="sm:col-span-2">
                <input readOnly value={warehouse.code} className={`${compactInputClassName} font-mono tracking-wide`} />
              </FormField>
              <FormField label="Nom" className="sm:col-span-2">
                <input
                  required
                  minLength={2}
                  value={name}
                  disabled={!canManage}
                  onChange={(event) => onName(event.target.value)}
                  className={compactInputClassName}
                />
              </FormField>
              <FormField label="Adresse" className="sm:col-span-2">
                <textarea
                  rows={2}
                  value={address}
                  disabled={!canManage}
                  onChange={(event) => onAddress(event.target.value)}
                  className={compactTextareaClassName}
                  placeholder="Commune, avenue, repère…"
                />
              </FormField>
              {canManage ? (
                <FormField label="Statut" hint="La désactivation du seul entrepôt actif est refusée." className="sm:col-span-2">
                  <select
                    value={status}
                    onChange={(event) => onStatus(event.target.value as ReferentialStatus)}
                    className={compactInputClassName}
                  >
                    <option value="ACTIVE">En service</option>
                    <option value="INACTIVE">Hors service</option>
                  </select>
                </FormField>
              ) : null}
            </div>
          </FormSection>

          {canManage ? (
            <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
              <Button type="submit" disabled={pending}>
                {pending ? "Enregistrement…" : "Enregistrer la fiche"}
              </Button>
              <p className="text-xs text-slate-500">Les réceptions et transferts conservent l’identifiant technique.</p>
            </div>
          ) : (
            <Alert tone="info">Votre profil peut consulter l’entrepôt, pas modifier la fiche.</Alert>
          )}
        </div>
      </section>

      <aside className="space-y-4">
        <QuickLinksCard canManage={canManage} canStock={canStock} />
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-4 text-xs leading-relaxed text-slate-500">
          Les opérations stock (réceptions, ajustements, expéditions) se font depuis{" "}
          <strong className="font-medium text-slate-700">Stocks → Entrepôt central</strong>. Cette page ne gère que la fiche
          référentielle.
        </div>
      </aside>
    </form>
  );
}

function QuickLinksCard({ canManage, canStock }: { canManage: boolean; canStock: boolean }) {
  const links = [
    canStock
      ? { to: "/admin/central-warehouse", label: "Pilotage entrepôt", hint: "Réceptions et ajustements" }
      : null,
    canStock ? { to: "/admin/stock", label: "Soldes & mouvements", hint: "Grand livre stock" } : null,
    canStock ? { to: "/admin/transfers", label: "Transferts", hint: "Entrepôt → boutiques" } : null,
    canManage ? { to: "/admin/stores", label: "Boutiques", hint: "Points de vente du réseau" } : null,
  ].filter((row): row is { to: string; label: string; hint: string } => row !== null);

  if (links.length === 0) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Aller plus loin</p>
      </div>
      <ul className="divide-y divide-slate-100">
        {links.map((link) => (
          <li key={link.to}>
            <Link
              to={link.to}
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition hover:bg-slate-50"
            >
              <span>
                <span className="block font-medium text-slate-900">{link.label}</span>
                <span className="mt-0.5 block text-[11px] text-slate-500">{link.hint}</span>
              </span>
              <ChevronIcon />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WarehouseMonogram({ code, inactive }: { code: string; inactive: boolean }) {
  const glyph = code.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase() || "WH";
  return (
    <span
      className={`grid size-14 shrink-0 place-items-center rounded-2xl font-mono text-xs font-semibold tracking-wide ${
        inactive
          ? "border border-slate-200 bg-slate-100 text-slate-500"
          : "border border-orange-200/80 bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-sm"
      }`}
      aria-hidden
    >
      {glyph}
    </span>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "neutral" | "warning";
}) {
  const valueClass = tone === "warning" ? "text-amber-900" : "text-slate-900";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 font-mono text-xl tabular-nums tracking-tight ${valueClass}`}>{value}</p>
      <p className="mt-1 text-[11px] text-slate-500">{hint}</p>
    </div>
  );
}

function formatQty(value: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(value));
}

function ChevronIcon() {
  return (
    <svg className="size-3.5 shrink-0 text-slate-400" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M6 4.5 10.5 8 6 11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}