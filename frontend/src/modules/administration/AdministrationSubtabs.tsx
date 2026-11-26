import { useMemo } from "react";
import { NavLink } from "react-router-dom";
import { renderNavIcon } from "../../components/admin/AdminNavIcons";
import { ADMIN_SETTINGS_SECTIONS } from "../../lib/navigation/admin-nav";
import { hasPermission } from "../../lib/auth/permissions";
import { useAuth } from "../auth/AuthProvider";

function tabClass(isActive: boolean) {
  return `inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
    isActive ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
  }`;
}

export function AdministrationSubtabs() {
  const { user } = useAuth();
  const items = useMemo(() => {
    if (!user) {
      return [];
    }
    return ADMIN_SETTINGS_SECTIONS.flatMap((section) => section.items).filter(
      (item) =>
        item.permissions.length === 0 ||
        item.permissions.some((permission) => hasPermission(user, permission)),
    );
  }, [user]);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
      {items.map((item) => (
        <NavLink
          key={item.id}
          to={item.to}
          end={item.end}
          className={({ isActive }) => tabClass(isActive)}
        >
          {renderNavIcon(item.id, "inline-flex size-3.5 shrink-0 items-center justify-center")}
          <span>{item.label}</span>
        </NavLink>
      ))}
    </div>
  );
}