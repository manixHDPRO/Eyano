import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { StatusBadge } from "../../components/StatusBadge";
import { linkButtonClassName } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { inputClassName } from "../../components/ui/FormField";
import { PageHeader } from "../../components/ui/PageHeader";
import { Pagination } from "../../components/ui/Pagination";
import { formatApiErrorMessage } from "../../lib/api/errors";
import { fetchSuppliers } from "../../lib/api/suppliers";
import { referentialStatusLabel, referentialStatusTone } from "../network/referential-status";

export function SuppliersListPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const query = useQuery({
    queryKey: ["suppliers", page, search, status],
    queryFn: () =>
      fetchSuppliers({
        page,
        pageSize: 12,
        search: search.trim() || undefined,
        status: status || undefined,
      }),
  });

  const errorMessage = query.isError ? formatApiErrorMessage(query.error, "Chargement impossible.") : null;
  const items = query.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Réseau"
        title="Fournisseurs"
        description="Référentiel des partenaires d’approvisionnement. Les réceptions en brouillon sont saisies séparément avant validation et mouvement de stock."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/central-warehouse" className={linkButtonClassName}>
              Entrepôt central
            </Link>
            <Link to="/admin/suppliers/new" className={linkButtonClassName}>
              Nouveau fournisseur
            </Link>
          </div>
        }
      />

      {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}

      <section className="grid gap-3 sm:grid-cols-2">
        <Stat label="Actifs" value={query.data?.stats.active} />
        <Stat label="Inactifs" value={query.data?.stats.inactive} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-sm">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="md:col-span-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Recherche</span>
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Nom, e-mail, téléphone…"
              className={inputClassName}
            />
          </label>
          <label>
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Statut</span>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className={inputClassName}
            >
              <option value="">Tous</option>
              <option value="ACTIVE">En service</option>
              <option value="INACTIVE">Hors service</option>
            </select>
          </label>
        </div>

        <ul className="mt-4 divide-y divide-white/5">
          {items.map((supplier) => (
            <li key={supplier.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <Link to={`/admin/suppliers/${supplier.id}`} className="font-medium text-slate-900 hover:underline">
                  {supplier.name}
                </Link>
                <p className="text-sm text-slate-400">
                  {supplier.phone ?? "—"} · {supplier.email ?? "—"}
                </p>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-400">
                <span>{supplier.receiptCount} réception(s)</span>
                <StatusBadge label={referentialStatusLabel(supplier.status)} tone={referentialStatusTone(supplier.status)} />
              </div>
            </li>
          ))}
          {items.length === 0 && !query.isLoading ? (
            <li className="py-8 text-center text-sm text-slate-500">Aucun fournisseur pour ces filtres.</li>
          ) : null}
        </ul>

        {query.data ? (
          <div className="mt-4">
            <Pagination
              page={query.data.page}
              totalPages={query.data.totalPages}
              totalItems={query.data.total}
              onPageChange={setPage}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold text-slate-900">{value ?? "—"}</dd>
    </div>
  );
}