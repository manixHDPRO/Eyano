import type { ReactNode } from "react";
import { formatUsd } from "../catalog/money";

export function PeriodSnapshotValues({
  items,
}: {
  items: { label: string; value: string }[];
}) {
  const multi = items.length > 1;
  return (
    <dl
      className={
        multi ? "grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2" : "grid min-w-0 grid-cols-1 gap-2"
      }
    >
      {items.map((item) => (
        <div key={item.label} className="min-w-0 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5">
          <dt className="text-[11px] font-medium leading-snug text-slate-600">{item.label}</dt>
          <dd className="mt-1 text-sm font-semibold tabular-nums leading-none text-slate-900 sm:text-base">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function HistoryMeta({
  from,
  to,
  author,
  reason,
}: {
  from: string;
  to: string | null;
  author: string | null;
  reason: string | null;
}) {
  return (
    <div className="mt-3 space-y-1 border-t border-slate-200/80 pt-2.5">
      {reason ? <p className="text-xs leading-snug text-slate-600">{reason}</p> : null}
      <p className="break-words text-[11px] leading-snug text-slate-500">
        {formatPeriod(from, to)}
        {author ? (
          <>
            <span aria-hidden="true"> · </span>
            <span className="font-medium text-slate-600">{author}</span>
          </>
        ) : null}
      </p>
    </div>
  );
}

function formatPeriod(from: string, to: string | null): string {
  const start = new Date(from).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
  if (!to) {
    return `En vigueur depuis le ${start}`;
  }
  const end = new Date(to).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
  return `Du ${start} au ${end}`;
}

export function HistoryPeriodCard({
  tone,
  badge,
  children,
}: {
  tone: "current" | "archived";
  badge: string;
  children: ReactNode;
}) {
  const border =
    tone === "current" ? "border-emerald-200 bg-emerald-50/80" : "border-slate-200 bg-slate-50/90";

  return (
    <li className={`min-w-0 rounded-xl border px-3 py-3 ${border}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 text-xs font-semibold leading-snug text-slate-700">{badge}</p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase leading-none ${
            tone === "current"
              ? "bg-emerald-100 text-emerald-800"
              : "bg-slate-200 text-slate-600"
          }`}
        >
          {tone === "current" ? "Actuel" : "Archivé"}
        </span>
      </div>
      <div className="min-w-0">{children}</div>
    </li>
  );
}

export function formatPriceSnapshot(purchase: number, official: number): { label: string; value: string }[] {
  return [
    { label: "Prix d’achat", value: formatUsd(purchase) },
    { label: "Prix officiel", value: formatUsd(official) },
  ];
}

export function formatDiscountSnapshot(percent: number): { label: string; value: string }[] {
  return [{ label: "Remise appliquée", value: `${percent.toFixed(2)} %` }];
}