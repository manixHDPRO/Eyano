import type { ReactNode } from "react";
import { StatusBadge } from "../../components/StatusBadge";
import { formatCdfPerUsd } from "../../lib/money/exchange-rate-defaults";
import type { PosWorkspaceRegister } from "../../lib/api/types";
import { posPanelClassName } from "./pos-shell-styles";

type PosRegisterHeaderProps = {
  storeLabel: { name: string; city: string | null } | null;
  encaissementRate: number;
  sessionOpen: boolean;
  registers: PosWorkspaceRegister[];
  registerId: string;
  storeLocked: boolean;
  onRegisterChange: (id: string) => void;
  actions: ReactNode;
};

export function PosRegisterHeader({
  storeLabel,
  encaissementRate,
  sessionOpen,
  registers,
  registerId,
  storeLocked,
  onRegisterChange,
  actions,
}: PosRegisterHeaderProps) {
  const activeRegister = registers.find((row) => row.id === registerId);

  return (
    <section className={posPanelClassName}>
      <div className="border-b border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-5 text-white sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Point de vente</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-[1.65rem]">Caisse &amp; encaissement</h1>
            <p className="mt-2 text-sm text-slate-300">
              {storeLabel ? (
                <>
                  <span className="font-medium text-white">{storeLabel.name}</span>
                  {storeLabel.city ? <span className="text-slate-400"> · {storeLabel.city}</span> : null}
                </>
              ) : (
                "Sélectionnez une caisse"
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <StatusBadge
              label={sessionOpen ? "Session ouverte" : "Session fermée"}
              tone={sessionOpen ? "success" : "neutral"}
            />
            <span className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 font-mono tabular-nums text-slate-100">
              1 USD = {formatCdfPerUsd(encaissementRate)} CDF
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Terminal</span>
          {activeRegister ? (
            storeLocked ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm">
                {activeRegister.store.name} ({activeRegister.store.code}) — {activeRegister.code}
              </span>
            ) : (
              <select
                id="pos-register"
                className="max-w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 shadow-sm"
                value={registerId}
                onChange={(event) => onRegisterChange(event.target.value)}
              >
                {registers.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.store.name} ({row.store.code}) — {row.code}
                    {row.openSession ? " · ouverte" : ""}
                  </option>
                ))}
              </select>
            )
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">{actions}</div>
      </div>
    </section>
  );
}

// fix typo motionicle -> div in file