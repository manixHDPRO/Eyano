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
import { fetchGoodsReceipts } from "../../lib/api/goods-receipts";
import { goodsReceiptStatusLabel, goodsReceiptStatusTone } from "./goods-receipt-status";

export function GoodsReceiptsListPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  const query = useQuery({
    queryKey: ["goods-receipts", page, status, search],
    queryFn: () =>
      fetchGoodsReceipts({
        page,
        pageSize: 15,
        status: status || undefined,
        search: search.trim() || undefined,
      }),
  });

  const errorMessage = query.isError ? formatApiErrorMessage(query.error, "Chargement impossible.") : null;
  const items = query.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Stocks"
        title="Réceptions fournisseur"
        description="Brouillon → validation transactionnelle : un mouvement GOODS_RECEIPT et un seul incrément d’entrepôt par ligne. Le prix d’achat catalogue n’est jamais mis à jour automatiquement."
        actions={
          <Link to="/admin/goods-receipts/new" className={linkButtonClassName}>
            Nouvelle réception
          </Link>
        }
      />

      {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-sm">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="md:col-span-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Référence</span>
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="RC000123…"
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
              <option value="DRAFT">Brouillon</option>
              <option value="VALIDATED">Validée</option>
              <option value="CANCELLED">Annulée</option>
            </select>
          </label>
        </div>

        <ul className="mt-4 divide-y divide-white/5">
          {items.map((receipt) => (
            <li key={receipt.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <Link to={`/admin/goods-receipts/${receipt.id}`} className="font-mono text-sm font-semibold text-slate-900 hover:underline">
                  {receipt.reference}
                </Link>
                <p className="text-sm text-slate-400">
                  {receipt.supplier.name} → {receipt.warehouse.code} · {receipt.lineCount} ligne(s) · {receipt.totalQuantity} u.
                </p>
              </div>
              <StatusBadge label={goodsReceiptStatusLabel(receipt.status)} tone={goodsReceiptStatusTone(receipt.status)} />
            </li>
          ))}
          {items.length === 0 && !query.isLoading ? (
            <li className="py-8 text-center text-sm text-slate-500">Aucune réception.</li>
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