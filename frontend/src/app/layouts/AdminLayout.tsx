import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AdminAtelierNav, AdminRailNav, AdminTopNav } from "../../components/admin/AdminMenuVariants";
import { AdminShellHeader } from "../../components/admin/AdminShellHeader";
import { AdminSidebarNav } from "../../components/admin/AdminSidebarNav";
import { EyanoLogo } from "../../components/EyanoLogo";
import { useAdminNav } from "../../lib/navigation/useAdminNav";
import { useAuth } from "../../modules/auth/AuthProvider";
import { usePresentation } from "../../modules/presentation/PresentationProvider";
import type { MenuModelId } from "../../modules/presentation/presentation";

export function AdminLayout() {
  const { user } = useAuth();
  const { menu } = usePresentation();
  const navGroups = useAdminNav(user);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const closeMobile = () => setMobileOpen(false);

  return (
    <div
      data-menu={menu}
      className={`admin-shell min-h-dvh bg-slate-50 text-slate-900 ${
        menu === "top" ? "" : "lg:grid lg:grid-cols-[auto_minmax(0,1fr)]"
      }`}
    >
      <DesktopMenu menu={menu} groups={navGroups} />

      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-white lg:hidden"
          aria-label="Fermer le menu"
          onClick={closeMobile}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-slate-200 bg-white shadow-2xl transition-transform lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarChrome groups={navGroups} onNavigate={closeMobile} className="px-4 py-5" />
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col">
        <AdminShellHeader onOpenMenu={() => setMobileOpen(true)} />
        {menu === "top" ? (
          <div className="hidden lg:block">
            <AdminTopNav groups={navGroups} />
          </div>
        ) : null}
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function DesktopMenu({
  menu,
  groups,
}: {
  menu: MenuModelId;
  groups: ReturnType<typeof useAdminNav>;
}) {
  switch (menu) {
    case "top":
      return null;
    case "rail":
      return (
        <aside className="sticky top-0 hidden h-dvh border-r border-slate-200 bg-white lg:flex">
          <AdminRailNav groups={groups} />
        </aside>
      );
    case "glace":
      return (
        <aside className="sticky top-0 hidden h-dvh p-3 lg:block">
          <div className="eyano-glass-panel flex h-full w-64 flex-col overflow-hidden rounded-[1.75rem]">
            <SidebarChrome groups={groups} />
          </div>
        </aside>
      );
    case "atelier":
      return (
        <aside className="sticky top-0 hidden h-dvh w-72 lg:flex">
          <AdminAtelierNav groups={groups} />
        </aside>
      );
    case "accordion":
      return (
        <aside className="sticky top-0 hidden h-dvh border-r border-slate-200 bg-white lg:flex">
          <div className="w-60">
            <SidebarChrome groups={groups} />
          </div>
        </aside>
      );
    default: {
      const unknown: never = menu;
      return unknown;
    }
  }
}

function SidebarChrome({
  groups,
  onNavigate,
  className,
}: {
  groups: ReturnType<typeof useAdminNav>;
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <div className={`flex h-full min-h-0 w-full flex-col ${className ?? "px-4 py-5"}`}>
      <div className="shrink-0">
        <EyanoLogo onLight />
        <p className="mt-3 text-[11px] text-slate-500">Gestion commerciale</p>
      </div>
      <div className="mt-1 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
        <AdminSidebarNav groups={groups} onNavigate={onNavigate} />
      </div>
    </div>
  );
}