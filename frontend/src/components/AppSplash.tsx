import { EYANO_LOGO_ALT, EYANO_LOGO_LIGHT_SRC } from "../lib/brand";

type AppSplashProps = {
  leaving: boolean;
};

export function AppSplash({ leaving }: AppSplashProps) {
  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center transition-opacity duration-700 ease-out ${
        leaving ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      role="status"
      aria-busy={!leaving}
      aria-label="Chargement Eyano"
    >
      <div className="absolute inset-0 bg-slate-50" aria-hidden />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,var(--color-eyano-cyan-glow)_0%,transparent_55%)] opacity-60"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,var(--color-eyano-accent-glow)_0%,transparent_35%)] opacity-40"
        aria-hidden
      />

      <div className="relative z-10 flex w-full max-w-3xl flex-col items-center px-6">
        <div className="overflow-hidden rounded-2xl bg-black shadow-2xl shadow-slate-900/25 ring-1 ring-slate-200">
          <img
            src={EYANO_LOGO_LIGHT_SRC}
            alt={EYANO_LOGO_ALT}
            className="w-full max-w-xl object-contain"
            width={1024}
            height={280}
            decoding="async"
            fetchPriority="high"
          />
        </div>
        <div className="mt-8 h-1 w-40 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full w-1/3 animate-[eyano-splash-bar_1.2s_ease-in-out_infinite] rounded-full bg-slate-900" />
        </div>
        <p className="mt-4 text-xs font-medium tracking-widest text-slate-600 uppercase">Chargement…</p>
      </div>
    </div>
  );
}