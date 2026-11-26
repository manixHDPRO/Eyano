import { useMemo } from "react";
import { Navigate } from "react-router-dom";
import { ADMIN_SETTINGS_SECTIONS } from "../../lib/navigation/admin-nav";
import { hasPermission } from "../../lib/auth/permissions";
import { useAuth } from "../auth/AuthProvider";

export function AdministrationRedirect() {
  const { user } = useAuth();
  const firstPath = useMemo(() => {
    if (!user) {
      return null;
    }
    const items = ADMIN_SETTINGS_SECTIONS.flatMap((section) => section.items);
    return (
      items.find(
        (item) =>
          item.permissions.length === 0 ||
          item.permissions.some((permission) => hasPermission(user, permission)),
      )?.to ?? null
    );
  }, [user]);

  if (!firstPath) {
    return <Navigate to="/admin" replace />;
  }

  return <Navigate to={firstPath} replace />;
}