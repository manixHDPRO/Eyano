import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../../lib/api/errors";
import { EYANO_AUTH_HERO_ALT, EYANO_AUTH_HERO_LIGHT_SRC, EYANO_AUTH_HERO_SRC } from "../../lib/brand";
import { homePathForRole } from "../../lib/api/auth";
import { isDarkTheme } from "../theme/theme";
import { useAuth } from "./AuthProvider";
import { ThemePicker, useTheme } from "../theme/ThemeProvider";

export function LoginPage() {
  const { user, ready, login } = useAuth();
  const { themeId } = useTheme();
  const darkTheme = isDarkTheme(themeId);
  const heroSrc = darkTheme ? EYANO_AUTH_HERO_SRC : EYANO_AUTH_HERO_LIGHT_SRC;
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("admin@eyano.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const from = (location.state as { from?: string } | null)?.from;

  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[var(--eyano-page)] text-sm text-slate-500">
        Restauration de la session…
      </div>
    );
  }

  if (user) {
    return <Navigate to={from ?? homePathForRole(user.role.code)} replace />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const connected = await login(email, password);
      navigate(from ?? homePathForRole(connected.role.code), { replace: true });
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
      } else {
        setError("Impossible de se connecter pour le moment.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid min-h-dvh bg-[var(--eyano-page)] md:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
      <section className="flex items-center justify-center px-3 py-5 sm:px-6 md:px-8">
        <img
          src={heroSrc}
          alt={EYANO_AUTH_HERO_ALT}
          className="eyano-auth-hero w-full max-w-4xl object-contain [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent),linear-gradient(to_bottom,transparent,black_7%,black_90%,transparent)] [mask-composite:intersect] [-webkit-mask-composite:source-in]"
          width={1024}
          height={682}
          decoding="async"
          fetchPriority="high"
        />
      </section>

      <section className="flex items-center justify-center px-4 pb-8 sm:px-6 md:px-8 md:py-8">
        <div className="eyano-auth-card w-full max-w-md rounded-3xl border border-white/10 bg-white p-6 shadow-[0_24px_70px_rgba(0,0,0,0.4)]">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold tracking-[0.22em] text-[#f47a12] uppercase">Eyano</p>
            <ThemePicker />
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 font-display">Connexion</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Identifiez-vous pour ouvrir l&apos;administration, la caisse ou le suivi des stocks.
          </p>

          <form className="mt-5 space-y-3.5" onSubmit={onSubmit}>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">E-mail</span>
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#f47a12] focus:bg-white focus:ring-4 focus:ring-[#f47a12]/15"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">Mot de passe</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#f47a12] focus:bg-white focus:ring-4 focus:ring-[#f47a12]/15"
              />
            </label>
            {error ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-xl bg-gradient-to-r from-[#ff9a1f] to-[#f26512] py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(242,101,18,0.35)] transition hover:brightness-105 disabled:cursor-wait disabled:opacity-70"
            >
              {pending ? "Connexion…" : "Se connecter"}
            </button>
          </form>

          <p className="mt-4 text-xs leading-relaxed text-slate-500">
            Le compte de démonstration est prérempli. Plusieurs échecs consécutifs verrouillent l&apos;accès.
          </p>
        </div>
      </section>
    </div>
  );
}
