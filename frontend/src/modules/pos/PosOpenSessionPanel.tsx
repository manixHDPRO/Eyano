import { Button } from "../../components/ui/Button";
import type { PosWorkspaceRegister } from "../../lib/api/types";
import { posPanelBodyClassName, posPanelClassName } from "./pos-shell-styles";

type PosOpenSessionPanelProps = {
  register: PosWorkspaceRegister;
  canOpen: boolean;
  busy: boolean;
  onOpen: (payload: { openingFloatUsd: number; openingFloatCdf: number }) => void;
};

export function PosOpenSessionPanel({ register, canOpen, busy, onOpen }: PosOpenSessionPanelProps) {
  return (
    <section className={`mx-auto max-w-xl ${posPanelClassName}`}>
      <header className="border-b border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-white px-6 py-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-800">Démarrage</p>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">Ouverture de session</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Déclarez le fond de caisse pour <span className="font-medium text-slate-900">{register.store.name}</span> (
          {register.code}) avant la première vente.
        </p>
      </header>
      <form
        className={`space-y-5 ${posPanelBodyClassName}`}
        onSubmit={(event) => {
          event.preventDefault();
          if (!canOpen) {
            return;
          }
          const form = event.currentTarget;
          const usd = Number((form.elements.namedItem("floatUsd") as HTMLInputElement).value);
          const cdf = Number((form.elements.namedItem("floatCdf") as HTMLInputElement).value);
          onOpen({
            openingFloatUsd: Number.isFinite(usd) ? usd : 0,
            openingFloatCdf: Number.isFinite(cdf) ? cdf : 0,
          });
        }}
      >
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs font-medium text-slate-700">Fond initial USD</span>
            <input
              name="floatUsd"
              type="number"
              min={0}
              step={0.01}
              defaultValue={50}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-sm shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-700">Fond initial CDF</span>
            <input
              name="floatCdf"
              type="number"
              min={0}
              step={100}
              defaultValue={100_000}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-sm shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
            />
          </label>
        </div>
        <Button type="submit" className="w-full py-2.5" disabled={!canOpen || busy}>
          {busy ? "Ouverture…" : "Ouvrir la session de caisse"}
        </Button>
        {!canOpen ? <p className="text-center text-xs text-slate-500">Permission cash.session requise.</p> : null}
      </form>
    </section>
  );
}