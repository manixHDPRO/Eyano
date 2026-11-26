import type { ReactNode } from "react";
import { Navigate, useParams } from "react-router-dom";
import { ALL_NAV_ITEMS_PREVIEW_LOOKUP } from "../../lib/navigation/admin-nav";
import { hasAnyPermission } from "../../lib/navigation/admin-access";
import { useAuth } from "./AuthProvider";

type RequireAdminNavSectionProps = {
  children: ReactNode;
};

export function RequireAdminNavSection({ children }: RequireAdminNavSectionProps) {
  const { section } = useParams<{ section: string }>();
  const { user, ready } = useAuth();
  const item = section ? ALL_NAV_ITEMS_PREVIEW_LOOKUP.get(section) : undefined;

  if (!ready) {
    return (
      <div className="grid min-h-[40vh] place-items-center text-sm text-slate-400">Chargement des droits…</div>
    );
  }

  if (!user || !item) {
    return <Navigate to="/admin" replace />;
  }

  if (item.permissions.length > 0 && !hasAnyPermission(user, item.permissions)) {
    return <Navigate to="/admin" replace />;
  }

  return children;
}