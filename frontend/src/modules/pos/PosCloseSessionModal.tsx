import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { modalFieldClassName } from "../../components/ui/form-styles";
import type { CashSessionDetail } from "../../lib/api/types";
import { CashSessionLedgerSummary } from "../sales/CashSessionLedgerSummary";
import { formatCdf, formatUsd } from "../catalog/money";

type PosCloseSessionModalProps = {
  session: CashSessionDetail;
  onConfirm: (payload: { countedUsd: number; countedCdf: number; note?: string }) => void;
  onClose: () => void;
  busy: boolean;
};

export function PosCloseSessionModal({ session, onConfirm, onClose, busy }: PosCloseSessionModalProps) {
  const [countedUsd, setCountedUsd] = useState(() => String(session.theoreticalBalanceUsd));
  const [countedCdf, setCountedCdf] = useState(() => String(Math.round(session.theoreticalBalanceCdf)));
  const [note, setNote] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose]);

  const parsedUsd = Number(countedUsd);
  const parsedCdf = Number(countedCdf);

  const variance = useMemo(() => {
    const usd = Number.isFinite(parsedUsd) ? parsedUsd - session.theoreticalBalanceUsd : null;
    const cdf = Number.isFinite(parsedCdf) ? Math.round(parsedCdf) - session.theoreticalBalanceCdf : null;
    return { usd, cdf };
  }, [parsedCdf, parsedUsd, session.theoreticalBalanceCdf, session.theoreticalBalanceUsd]);

  const hasVariance =
    variance.usd != null &&
    variance.cdf != null &&
    (Math.abs(variance.usd) > 0.01 || Math.abs(variance.cdf) > 100);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!Number.isFinite(parsedUsd) || !Number.isFinite(parsedCdf) || parsedUsd < 0 || parsedCdf < 0) {
      return;
    }
    onConfirm({
      countedUsd: parsedUsd,
      countedCdf: Math.round(parsedCdf),
      note: note.trim() || undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pos-close-session-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Fermer la clôture"
        onClick={() => {
          if (!busy) {
            onClose();
          }
        }}
      />

      <div className="relative flex max-h-[94vh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/30 sm:rounded-2xl">
        <header className="shrink-0 border-b border-rose-100 bg-gradient-to-br from-rose-50 via-white to-white px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-rose-800">Fin de journée</p>
          <h2 id="pos-close-session-title" className="mt-0.5 text-lg font-bold tracking-tight text-slate-900">
            Clôture de caisse
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            {session.store.name} — {session.cashRegister.code} · comparez le comptage physique au solde théorique.
          </p>
        </header>

        <form onSubmit={submit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          <CashSessionLedgerSummary session={session} variant="pos" title="Situation avant clôture" />

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-slate-700">
              Compté USD *
              <input
                type="number"
                min={0}
                step={0.01}
                required
                value={countedUsd}
                onChange={(event) => setCountedUsd(event.target.value)}
                className={`${modalFieldClassName} mt-1 font-mono`}
              />
            </label>
            <label className="block text-xs font-medium text-slate-700">
              Compté CDF *
              <input
                type="number"
                min={0}
                step={1}
                required
                value={countedCdf}
                onChange={(event) => setCountedCdf(event.target.value)}
                className={`${modalFieldClassName} mt-1 font-mono`}
              />
            </label>
          </div>

          {variance.usd != null && variance.cdf != null ? (
            <p
              className={`rounded-xl border px-3 py-2 text-xs ${
                hasVariance
                  ? "border-amber-200 bg-amber-50 text-amber-950"
                  : "border-emerald-200 bg-emerald-50 text-emerald-950"
              }`}
            >
              Écart constaté :{" "}
              <span className="font-mono font-semibold">{formatUsd(variance.usd)}</span> USD ·{" "}
              <span className="font-mono font-semibold">{formatCdf(variance.cdf)}</span> CDF
            </p>
          ) : null}

          <label className="block text-xs font-medium text-slate-700">
            Note (facultatif)
            <textarea
              value={note}
              maxLength={500}
              onChange={(event) => setNote(event.target.value)}
              className={`${modalFieldClassName} mt-1 min-h-20`}
              placeholder="Motif d’écart, remarque de fin de journée…"
            />
          </label>

          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Clôture…" : "Confirmer la clôture"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}