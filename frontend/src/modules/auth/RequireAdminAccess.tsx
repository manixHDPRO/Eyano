import { Navigate, Outlet, useLocation } from "react-router-dom";
import { canAccessAdmin } from "../../lib/navigation/admin-access";
import { useAuth } from "./AuthProvider";

export function RequireAdminAccess() {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center bg-slate-50 text-sm text-slate-400">
        Restauration de la session…
      </div>
    );
  }

  if (!user || !canAccessAdmin(user)) {
    return <Navigate to="/pos" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}