import type { CashSessionDetail } from "../../lib/api/types";
import { formatCdf, formatUsd } from "../catalog/money";

type CashSessionLedgerSummaryProps = {
  session: CashSessionDetail;
  variant?: "compact" | "admin" | "pos";
  title?: string;
  subtitle?: string;
};

export function CashSessionLedgerSummary({
  session,
  variant = "compact",
  title,
  subtitle,
}: CashSessionLedgerSummaryProps) {
  if (variant === "admin") {
    return <CashSessionStatement session={session} title={title} subtitle={subtitle} />;
  }

  if (variant === "pos") {
    return (
      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-200 bg-gradient-to-r from-emerald-50/90 to-white px-3 py-2.5">
          {title ? <p className="text-[11px] font-semibold text-slate-900">{title}</p> : null}
          <p className="text-[10px] text-slate-500">Mouvements espèces de la session</p>
        </header>
        <dl className="space-y-0 divide-y divide-slate-100 px-3 py-1 text-[11px]">
          <PosLedgerLine label="Fond initial" usd={session.openingFloatUsd} cdf={session.openingFloatCdf} />
          <PosLedgerLine label="Encaissements" usd={session.collectionsUsd} cdf={session.collectionsCdf} hint="+ ventes" />
          <PosLedgerLine label="Dépenses tiroir" usd={session.expensesUsd} cdf={session.expensesCdf} subtract />
          <PosLedgerLine
            label="Solde théorique"
            usd={session.theoreticalBalanceUsd}
            cdf={session.theoreticalBalanceCdf}
            strong
          />
        </dl>
      </article>
    );
  }

  return (
    <div className="space-y-1 rounded-xl border border-slate-200 bg-white p-3 text-[11px]">
      {title ? (
        <p className="truncate font-semibold text-slate-900" title={session.id}>
          {title}
        </p>
      ) : null}
      <div className="space-y-1">
        <CompactMoneyRow label="Fond initial" usd={session.openingFloatUsd} cdf={session.openingFloatCdf} />
        <CompactMoneyRow label="Encaissements" usd={session.collectionsUsd} cdf={session.collectionsCdf} muted />
        <CompactMoneyRow
          label="Dépenses tiroir"
          usd={session.expensesUsd}
          cdf={session.expensesCdf}
          muted
          subtract
        />
        <CompactMoneyRow
          label="Solde théorique"
          usd={session.theoreticalBalanceUsd}
          cdf={session.theoreticalBalanceCdf}
          strong
        />
      </div>
    </div>
  );
}

function CashSessionStatement({
  session,
  title,
  subtitle,
}: {
  session: CashSessionDetail;
  title?: string;
  subtitle?: string;
}) {
  const varianceUsd = session.varianceUsd ?? 0;
  const varianceCdf = session.varianceCdf ?? 0;
  const hasVariance =
    session.status === "CLOSED" &&
    (Math.abs(varianceUsd) > 0.01 || Math.abs(varianceCdf) > 100);

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-200 bg-gradient-to-br from-slate-50 via-white to-emerald-50/40 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-800/80">Relevé de caisse</p>
            {title ? <h2 className="mt-0.5 text-base font-bold tracking-tight text-slate-900">{title}</h2> : null}
            {subtitle ? <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-600">{subtitle}</p> : null}
          </div>
          <p className="font-mono text-[10px] text-slate-400" title={session.id}>
            {session.id.slice(0, 8)}…
          </p>
        </div>
      </header>

      <div className="overflow-x-auto p-4">
        <StatementTable
          caption="Mouvements de la session"
          rows={[
            {
              label: "Fond initial à l’ouverture",
              usd: session.openingFloatUsd,
              cdf: session.openingFloatCdf,
              tone: "base",
            },
            {
              label: "Encaissements espèces (ventes)",
              usd: session.collectionsUsd,
              cdf: session.collectionsCdf,
              tone: "inflow",
              prefix: "+",
            },
            {
              label: "Dépenses tiroir confirmées",
              usd: session.expensesUsd,
              cdf: session.expensesCdf,
              tone: "outflow",
              prefix: "−",
            },
            {
              label: "Solde théorique",
              usd: session.theoreticalBalanceUsd,
              cdf: session.theoreticalBalanceCdf,
              tone: "total",
            },
          ]}
        />

        {session.status === "CLOSED" && session.countedUsd != null && session.countedCdf != null ? (
          <div className="mt-4">
            <StatementTable
              caption="Clôture — comptage physique"
              rows={[
                {
                  label: "Montant compté",
                  usd: session.countedUsd,
                  cdf: session.countedCdf,
                  tone: "base",
                },
                {
                  label: "Écart (compté − théorique)",
                  usd: varianceUsd,
                  cdf: varianceCdf,
                  tone: hasVariance ? "variance" : "total",
                  prefix: varianceUsd >= 0 ? "+" : "",
                  prefixCdf: varianceCdf >= 0 ? "+" : "",
                },
              ]}
            />
          </div>
        ) : null}
      </div>

      {session.status === "CLOSED" && session.note ? (
        <footer className="border-t border-slate-100 bg-slate-50/60 px-5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Note de clôture</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-800">{session.note}</p>
        </footer>
      ) : null}

      {session.status === "OPEN" ? (
        <footer className="border-t border-emerald-100 bg-emerald-50/50 px-5 py-3">
          <p className="text-xs text-emerald-950">
            Session encore ouverte — les totaux se mettent à jour à chaque vente ou dépense tiroir confirmée.
          </p>
        </footer>
      ) : null}
    </article>
  );
}

type StatementLine = {
  label: string;
  usd: number;
  cdf: number;
  tone: "base" | "inflow" | "outflow" | "total" | "variance";
  prefix?: string;
  prefixCdf?: string;
};

function StatementTable({ caption, rows }: { caption: string; rows: StatementLine[] }) {
  return (
    <table className="min-w-full text-left text-sm">
      <caption className="mb-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{caption}</caption>
      <thead>
        <tr className="border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          <th className="pb-2 pr-4 font-semibold">Rubrique</th>
          <th className="pb-2 pr-4 text-right font-semibold">USD</th>
          <th className="pb-2 text-right font-semibold">CDF</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((row) => (
          <StatementRow key={row.label} {...row} />
        ))}
      </tbody>
    </table>
  );
}

function StatementRow({ label, usd, cdf, tone, prefix = "", prefixCdf }: StatementLine) {
  const rowClass =
    tone === "total"
      ? "bg-slate-50 font-semibold text-slate-900"
      : tone === "variance"
        ? "bg-amber-50 font-semibold text-amber-950"
        : tone === "inflow"
          ? "text-slate-700"
          : tone === "outflow"
            ? "text-slate-700"
            : "text-slate-800";

  const usdPrefix = prefix || (tone === "outflow" ? "− " : "");
  const cdfPrefix = prefixCdf ?? prefix ?? (tone === "outflow" ? "− " : "");

  const displayUsd = tone === "outflow" ? Math.abs(usd) : usd;
  const displayCdf = tone === "outflow" ? Math.abs(cdf) : cdf;

  return (
    <tr className={rowClass}>
      <td className="py-2.5 pr-4 text-sm">{label}</td>
      <td className="py-2.5 pr-4 text-right font-mono text-sm tabular-nums">
        {usdPrefix}
        {formatUsd(displayUsd)}
      </td>
      <td className="py-2.5 text-right font-mono text-sm tabular-nums">
        {cdfPrefix}
        {formatCdf(displayCdf)}
      </td>
    </tr>
  );
}

function PosLedgerLine({
  label,
  usd,
  cdf,
  hint,
  strong,
  subtract,
}: {
  label: string;
  usd: number;
  cdf: number;
  hint?: string;
  strong?: boolean;
  subtract?: boolean;
}) {
  const prefix = subtract ? "− " : "";
  return (
    <div className={`flex justify-between gap-2 py-2 ${strong ? "bg-slate-50/80 font-semibold text-slate-900" : "text-slate-700"}`}>
      <dt className="min-w-0">
        <span>{label}</span>
        {hint ? <span className="ml-1 text-[10px] font-normal text-slate-400">{hint}</span> : null}
      </dt>
      <dd className="shrink-0 text-right font-mono text-[10px] tabular-nums leading-tight">
        {prefix}
        {formatUsd(subtract ? Math.abs(usd) : usd)}
        <br />
        {prefix}
        {formatCdf(subtract ? Math.abs(cdf) : cdf)}
      </dd>
    </div>
  );
}

function CompactMoneyRow({
  label,
  usd,
  cdf,
  muted = false,
  strong = false,
  subtract = false,
}: {
  label: string;
  usd: number;
  cdf: number;
  muted?: boolean;
  strong?: boolean;
  subtract?: boolean;
}) {
  const prefix = subtract ? "− " : "";
  return (
    <div
      className={`flex justify-between gap-1 ${strong ? "border-t border-slate-100 pt-1 font-semibold text-slate-900" : muted ? "text-slate-600" : "text-slate-600"}`}
    >
      <span className="shrink-0">{label}</span>
      <span className="truncate text-right font-mono text-[10px] tabular-nums leading-tight sm:text-[11px]">
        {prefix}
        {formatUsd(usd)} / {prefix}
        {formatCdf(cdf)}
      </span>
    </div>
  );
}