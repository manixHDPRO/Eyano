type PaginationProps = {
  page: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
};

export function Pagination({
  page,
  totalPages,
  totalItems,
  onPageChange,
  itemLabel = "éléments",
}: PaginationProps) {
  if (totalItems === 0) {
    return null;
  }

  const safeTotalPages = Math.max(1, totalPages);
  const tokens = paginationTokens(page, safeTotalPages);

  return (
    <div className="flex flex-col gap-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
      <p>
        Page {page} sur {safeTotalPages} — {totalItems} {itemLabel}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
        >
          Précédent
        </button>
        {tokens.map((token, index) =>
          token === "gap" ? (
            <span key={`gap-${index}`} className="px-1 py-1.5 text-slate-500">
              …
            </span>
          ) : (
            <button
              key={token}
              type="button"
              aria-current={token === page ? "page" : undefined}
              onClick={() => onPageChange(token)}
              className={`min-w-9 rounded-lg border px-2.5 py-1.5 font-medium tabular-nums transition ${
                token === page
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {token}
            </button>
          ),
        )}
        <button
          type="button"
          disabled={page >= safeTotalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
        >
          Suivant
        </button>
      </div>
    </div>
  );
}

type PageToken = number | "gap";

function paginationTokens(current: number, total: number): PageToken[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  const tokens: PageToken[] = [1];
  if (start > 2) {
    tokens.push("gap");
  }
  for (let page = start; page <= end; page += 1) {
    tokens.push(page);
  }
  if (end < total - 1) {
    tokens.push("gap");
  }
  tokens.push(total);
  return tokens;
}
