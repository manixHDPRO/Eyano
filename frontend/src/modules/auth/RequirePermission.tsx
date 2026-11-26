import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { hasAnyPermission } from "../../lib/navigation/admin-access";
import { hasPermission } from "../../lib/auth/permissions";
import { useAuth } from "./AuthProvider";

type RequirePermissionProps = {
  permission?: string;
  anyOf?: readonly string[];
  children: ReactNode;
};

export function RequirePermission({ permission, anyOf, children }: RequirePermissionProps) {
  const { user, ready } = useAuth();

  if (!ready) {
    return (
      <div className="grid min-h-[40vh] place-items-center text-sm text-slate-400">Chargement des droits…</div>
    );
  }

  const allowed = anyOf
    ? hasAnyPermission(user, anyOf)
    : permission
      ? hasPermission(user, permission)
      : Boolean(user);

  if (!user || !allowed) {
    return <Navigate to="/admin" replace />;
  }

  return children;
}