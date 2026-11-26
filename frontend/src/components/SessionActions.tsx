import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../modules/auth/AuthProvider";

type SessionActionsProps = {
  onLight?: boolean;
  variant?: "inline" | "cluster";
};

export function SessionActions({ onLight = false, variant = "inline" }: SessionActionsProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);

  if (!user) {
    return null;
  }

  const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();

  async function onLogout() {
    setPending(true);
    try {
      await logout();
      navigate("/login", { replace: true });
    } finally {
      setPending(false);
    }
  }

  const nameClass = onLight ? "text-slate-900" : "text-slate-200";
  const quietClass = onLight
    ? "rounded-full px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
    : "rounded-full px-2.5 py-1 text-xs font-medium text-slate-300 transition hover:bg-white/10 hover:text-white";

  if (variant === "cluster") {
    return (
      <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-1 pr-1 pl-1">
        <span className="grid size-8 place-items-center rounded-full bg-[#001433] text-[11px] font-semibold text-white">
          {initials}
        </span>
        <div className="hidden min-w-0 px-1 text-left sm:block">
          <p className={`truncate text-xs font-semibold leading-tight ${nameClass}`}>
            {user.firstName} {user.lastName}
          </p>
          <p className="truncate text-[10px] leading-tight text-slate-500">{user.role.name}</p>
        </div>
        <Link to="/account/password" className={`hidden sm:inline-flex ${quietClass}`}>
          Mot de passe
        </Link>
        <button
          type="button"
          onClick={() => void onLogout()}
          disabled={pending}
          className={`${quietClass} disabled:opacity-60`}
        >
          {pending ? "…" : "Déconnexion"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="hidden items-center gap-2 sm:flex">
        <span className="grid size-9 place-items-center rounded-full border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-700">
          {initials}
        </span>
        <div className="text-right">
          <p className={`text-sm font-medium ${nameClass}`}>
            {user.firstName} {user.lastName}
          </p>
          <p className="text-xs text-slate-500">{user.role.name}</p>
        </div>
      </div>
      <Link
        to="/account/password"
        className={
          onLight
            ? "hidden rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 sm:inline-flex"
            : "hidden rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/5 hover:text-white sm:inline-flex"
        }
      >
        Mot de passe
      </Link>
      <button
        type="button"
        onClick={() => void onLogout()}
        disabled={pending}
        className={
          onLight
            ? "rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            : "rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/5 hover:text-white disabled:opacity-60"
        }
      >
        {pending ? "…" : "Déconnexion"}
      </button>
    </div>
  );
}