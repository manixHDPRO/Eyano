import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert } from "../../components/ui/Alert";
import { Pagination } from "../../components/ui/Pagination";
import { fetchBarcodePrintLogs } from "../../lib/api/barcodes";
import { formatApiErrorMessage } from "../../lib/api/errors";
import { formatPrintWhen, printContextLabel } from "./barcode-display";

type BarcodePrintJournalProps = {
  productId?: string | null;
};

export function BarcodePrintJournal({ productId }: BarcodePrintJournalProps) {
  const [page, setPage] = useState(1);
  const logsQuery = useQuery({
    queryKey: ["barcode-print-logs", page, productId],
    queryFn: () => fetchBarcodePrintLogs({ page, pageSize: 12, productId: productId ?? undefined }),
  });

  const errorMessage = logsQuery.isError
    ? formatApiErrorMessage(logsQuery.error, "Journal d’impression indisponible.")
    : null;
  const items = logsQuery.data?.items ?? [];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Journal d’impression</p>
      <p className="mt-1 text-sm text-slate-400">
        Chaque réimpression est tracée : auteur, nombre de copies, contexte unitaire ou lot. Le code lui-même ne change pas.
      </p>
      {errorMessage ? (
        <div className="mt-4">
          <Alert tone="error">{errorMessage}</Alert>
        </div>
      ) : null}
      <ul className="mt-4 divide-y divide-white/5">
        {items.map((row) => (
          <li key={row.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">
                {row.product.reference} — {row.product.name}
              </p>
              <p className="mt-0.5 font-mono text-xs tracking-wider text-slate-600">{row.barcode.code}</p>
              <p className="mt-1 text-xs text-slate-500">
                {row.printedByName} · {formatPrintWhen(row.createdAt)}
              </p>
            </div>
            <div className="text-right text-xs text-slate-400">
              <p className="font-medium text-slate-700">
                {row.copies} {row.copies > 1 ? "copies" : "copie"}
              </p>
              <p className="mt-0.5">{printContextLabel(row.context)}</p>
            </div>
          </li>
        ))}
        {items.length === 0 && !logsQuery.isLoading ? (
          <li className="py-10 text-center text-sm text-slate-500">Aucune impression pour le moment.</li>
        ) : null}
      </ul>
      {logsQuery.data ? (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <Pagination
            page={logsQuery.data.page}
            totalPages={logsQuery.data.totalPages}
            totalItems={logsQuery.data.total}
            onPageChange={setPage}
            itemLabel="impressions"
          />
        </div>
      ) : null}
    </section>
  );
}
