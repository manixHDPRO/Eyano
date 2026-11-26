import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { StatusBadge } from "../../components/StatusBadge";
import { Button, ghostLinkClassName, linkButtonClassName } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { filterInputClassName, filterLabelClassName } from "../../components/ui/form-styles";
import { PageHeader } from "../../components/ui/PageHeader";
import { Pagination } from "../../components/ui/Pagination";
import { useToast } from "../../components/ui/Toast";
import { ApiError } from "../../lib/api/errors";
import { fetchCashRegisters, updateCashRegister } from "../../lib/api/cash-registers";
import { fetchStores } from "../../lib/api/stores";
import type { CashRegisterDetail } from "../../lib/api/types";
import { referentialStatusLabel, referentialStatusTone } from "./referential-status";

export function CashRegistersPage() {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [page, setPage] = useState(1);
  const [storeId, setStoreId] = useState("");
  const [status, setStatus] = useState("");

  const storesQuery = useQuery({
    queryKey: ["stores", "cash-register-filter"],
    queryFn: () => fetchStores({ page: 1, pageSize: 100 }),
  });

  const registersQuery = useQuery({
    queryKey: ["cash-registers", page, storeId, status],
    queryFn: () =>
      fetchCashRegisters({
        page,
        pageSize: 20,
        storeId: storeId || undefined,
        status: status || undefined,
      }),
  });

  const items = registersQuery.data?.items ?? [];
  const stats = useMemo(() => {
    const active = items.filter((row) => row.status === "ACTIVE").length;
    const defaults = items.filter((row) => row.isDefault).length;
    const stores = new Set(items.map((row) => row.storeId)).size;
    return { active, defaults, stores, total: items.length };
  }, [items]);

  const grouped = useMemo(() => groupByStore(items), [items]);

  const setDefaultMutation = useMutation({
    mutationFn: (registerId: string) => updateCashRegister(registerId, { isDefault: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cash-registers"] });
      await queryClient.invalidateQueries({ queryKey: ["stores"] });
      pushToast({ tone: "success", message: "Caisse par défaut mise à jour." });
    },
    onError: (caught) => {
      pushToast({
        tone: "error",
        message: caught instanceof ApiError ? caught.message : "Action refusée.",
      });
    },
  });

  const errorMessage =
    registersQuery.error instanceof ApiError
      ? registersQuery.error.message
      : registersQuery.isError
        ? "Chargement impossible."
        : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ventes & caisse"
        title="Caisses"
        description="Terminaux POS par boutique : code, statut et caisse par défaut pour l’ouverture de session."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/cash-sessions" className={ghostLinkClassName}>
              Sessions de caisse
            </Link>
            <Link to="/pos" className={linkButtonClassName}>
              Ouvrir le POS
            </Link>
          </div>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Caisses" value={registersQuery.isLoading ? "…" : String(stats.total)} hint="Selon filtres" />
        <Kpi label="Actives" value={registersQuery.isLoading ? "…" : String(stats.active)} hint="Statut ACTIVE" emphasize />
        <Kpi label="Boutiques" value={registersQuery.isLoading ? "…" : String(stats.stores)} hint="Sites couverts" />
        <Kpi label="Par défaut" value={registersQuery.isLoading ? "…" : String(stats.defaults)} hint="Une par boutique" />
      </section>

      {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Filtres</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
            <label>
              <span className={filterLabelClassName}>Boutique</span>
              <select
                value={storeId}
                onChange={(event) => {
                  setStoreId(event.target.value);
                  setPage(1);
                }}
                className={filterInputClassName}
              >
                <option value="">Toutes les boutiques</option>
                {storesQuery.data?.items.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.code} — {store.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={filterLabelClassName}>Statut</span>
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
                className={filterInputClassName}
              >
                <option value="">Toutes</option>
                <option value="ACTIVE">Actives</option>
                <option value="INACTIVE">Inactives</option>
              </select>
            </label>
          </div>
        </div>

        {registersQuery.isLoading ? (
          <p className="px-4 py-16 text-center text-sm text-slate-500">Chargement des caisses…</p>
        ) : grouped.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-base font-semibold text-slate-900">Aucune caisse</p>
            <p className="mt-2 text-sm text-slate-500">Créez une boutique : la caisse principale est créée automatiquement.</p>
            <Link to="/admin/stores" state={{ openNewStore: true }} className={`${linkButtonClassName} mt-6 inline-flex`}>
              Nouvelle boutique
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {grouped.map((group) => (
              <section key={group.storeId}>
                <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 px-4 py-3">
                  <div>
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      {group.storeCode}
                    </p>
                    <h3 className="text-sm font-semibold text-slate-900">{group.storeName}</h3>
                  </div>
                  <Link to={`/admin/stores/${group.storeId}`} className="text-xs font-semibold text-slate-600 hover:text-slate-900">
                    Fiche boutique
                  </Link>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-100 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-2 font-semibold">Code</th>
                        <th className="px-4 py-2 font-semibold">Libellé</th>
                        <th className="px-4 py-2 font-semibold">Statut</th>
                        <th className="px-4 py-2 font-semibold">Rôle</th>
                        <th className="px-4 py-2 text-right font-semibold" aria-hidden />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {group.registers.map((register) => (
                        <tr key={register.id} className="transition hover:bg-slate-50/80">
                          <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-900">{register.code}</td>
                          <td className="px-4 py-3 text-slate-800">{register.name}</td>
                          <td className="px-4 py-3">
                            <StatusBadge
                              label={referentialStatusLabel(register.status)}
                              tone={referentialStatusTone(register.status)}
                            />
                          </td>
                          <td className="px-4 py-3">
                            {register.isDefault ? (
                              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-900">
                                Par défaut
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">Secondaire</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {!register.isDefault && register.status === "ACTIVE" ? (
                              <Button
                                type="button"
                                variant="ghost"
                                className="px-2 py-1 text-xs"
                                disabled={setDefaultMutation.isPending}
                                onClick={() => setDefaultMutation.mutate(register.id)}
                              >
                                Définir par défaut
                              </Button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        )}

        {registersQuery.data && grouped.length > 0 ? (
          <div className="border-t border-slate-200 px-4 py-3">
            <Pagination
              page={registersQuery.data.page}
              totalPages={registersQuery.data.totalPages}
              totalItems={registersQuery.data.total}
              onPageChange={setPage}
              itemLabel="caisses"
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Kpi(props: { label: string; value: string; hint: string; emphasize?: boolean }) {
  return (
    <article
      className={`rounded-2xl border p-4 shadow-sm ${
        props.emphasize ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-white"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{props.label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{props.value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{props.hint}</p>
    </article>
  );
}

function groupByStore(items: CashRegisterDetail[]) {
  const groups = new Map<
    string,
    { storeId: string; storeCode: string; storeName: string; registers: CashRegisterDetail[] }
  >();
  for (const item of items) {
    const current = groups.get(item.storeId);
    if (current) {
      current.registers.push(item);
    } else {
      groups.set(item.storeId, {
        storeId: item.storeId,
        storeCode: item.store.code,
        storeName: item.store.name,
        registers: [item],
      });
    }
  }
  return [...groups.values()];
}