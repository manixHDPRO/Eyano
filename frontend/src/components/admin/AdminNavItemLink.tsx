import { NavLink } from "react-router-dom";
import type { AdminNavItem } from "../../lib/navigation/admin-nav";
import { AdminNavItemIcon, renderNavIcon } from "./AdminNavIcons";

function navLinkClass(isActive: boolean, nested: boolean) {
  const padding = nested ? "py-0.5 pl-1.5 pr-1.5" : "px-1.5 py-1";
  return `flex items-center justify-between gap-1.5 rounded-lg ${padding} text-xs font-medium leading-snug transition-colors ${
    isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
  }`;
}

type AdminNavItemLinkProps = {
  item: AdminNavItem;
  onNavigate?: () => void;
  nested?: boolean;
};

export function AdminNavItemLink({ item, onNavigate, nested = false }: AdminNavItemLinkProps) {
  return (
    <NavLink to={item.to} end={item.end} onClick={onNavigate} className={({ isActive }) => navLinkClass(isActive, nested)}>
      {({ isActive }) => (
        <>
          <span className={`flex min-w-0 flex-1 items-center ${nested ? "gap-2" : "gap-2"}`}>
            {nested ? (
              <span className={isActive ? "text-white" : "text-slate-500"}>
                {renderNavIcon(item.id)}
              </span>
            ) : (
              <AdminNavItemIcon itemId={item.id} active={isActive} />
            )}
            <span className="truncate">{item.label}</span>
          </span>
          {item.palier && !item.implemented ? (
            <span className="shrink-0 rounded-md bg-slate-100 px-1 py-0.5 text-[10px] font-medium text-slate-500">
              P{item.palier}
            </span>
          ) : null}
        </>
      )}
    </NavLink>
  );
}