import { useEffect, useMemo, useState } from "react";
import { useToast } from "../../components/ui/Toast";
import { formatCdf, formatUsd } from "../catalog/money";
import { formatCdfPerUsd } from "../../lib/money/exchange-rate-defaults";
import { encaissementCdfTotal, paidUsdTotal, type PosPaymentDraft } from "./pos-payments";
import { PosPaymentPanel } from "./PosPaymentPanel";

type PosEncaissementModalProps = {
  saleTotalUsd: number;
  encaissementRate: number;
  itemCount: number;
  onConfirm: (drafts: PosPaymentDraft[]) => void;
  onClose: () => void;
  busy: boolean;
};

export function PosEncaissementModal({
  saleTotalUsd,
  encaissementRate,
  itemCount,
  onConfirm,
  onClose,
  busy,
}: PosEncaissementModalProps) {
  const { pushToast } = useToast();
  const [drafts, setDrafts] = useState<PosPaymentDraft[]>([]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose]);

  const totalCdf = useMemo(
    () => encaissementCdfTotal(saleTotalUsd, encaissementRate),
    [encaissementRate, saleTotalUsd],
  );
  const paidUsd = useMemo(() => paidUsdTotal(drafts, encaissementRate), [drafts, encaissementRate]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/55 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pos-encaissement-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Fermer l’encaissement"
        onClick={() => {
          if (!busy) {
            onClose();
          }
        }}
      />

      <div className="relative flex max-h-[94vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/25 sm:max-w-xl sm:rounded-2xl">
        <header className="shrink-0 border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-700">Encaissement</p>
              <h2 id="pos-encaissement-title" className="mt-0.5 text-lg font-bold tracking-tight text-slate-900">
                Règlement de la vente
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {itemCount} article{itemCount > 1 ? "s" : ""} · Taux 1 USD ={" "}
                <span className="font-mono font-semibold text-slate-700">{formatCdfPerUsd(encaissementRate)}</span> CDF
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40"
              aria-label="Fermer"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <SummaryTile label="Total vente" usd={saleTotalUsd} cdf={totalCdf} emphasize />
            <SummaryTile label="Déjà saisi" usd={paidUsd} cdf={encaissementCdfTotal(paidUsd, encaissementRate)} />
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <PosPaymentPanel
            saleTotalUsd={saleTotalUsd}
            encaissementRate={encaissementRate}
            drafts={drafts}
            onChange={setDrafts}
            onConfirm={() => onConfirm(drafts)}
            onCancel={onClose}
            busy={busy}
            embedded
            onValidationMessage={(message) => pushToast({ tone: "error", message })}
          />
        </div>
      </div>
    </div>
  );
}

function SummaryTile(props: { label: string; usd: number; cdf: number; emphasize?: boolean }) {
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 ${
        props.emphasize ? "border-slate-300 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900"
      }`}
    >
      <p className={`text-[10px] font-medium uppercase tracking-wide ${props.emphasize ? "text-slate-300" : "text-slate-500"}`}>
        {props.label}
      </p>
      <p className="mt-0.5 font-mono text-sm font-bold tabular-nums">{formatUsd(props.usd)}</p>
      <p className={`font-mono text-[10px] tabular-nums ${props.emphasize ? "text-slate-400" : "text-slate-500"}`}>
        {formatCdf(props.cdf)} CDF
      </p>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}
