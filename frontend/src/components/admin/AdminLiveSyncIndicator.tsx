import { useLiveSyncConnection } from "../../lib/live-sync/use-live-sync-connection";

export function AdminLiveSyncIndicator() {
  const connected = useLiveSyncConnection();

  return (
    <span
      className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-slate-600 sm:inline-flex"
      title={
        connected
          ? "Les écrans se mettent à jour automatiquement dès qu’un autre poste modifie les données."
          : "Connexion temps réel en cours ou indisponible — rafraîchissement automatique de secours actif."
      }
      role="status"
      aria-live="polite"
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          connected ? "animate-pulse bg-emerald-500" : "bg-amber-500"
        }`}
        aria-hidden
      />
      {connected ? "Temps réel" : "Resync…"}
    </span>
  );
}