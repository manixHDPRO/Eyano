import { Outlet, useLocation } from "react-router-dom";
import { isAdministrationSectionPath } from "../../lib/navigation/admin-nav";
import { AdministrationSubtabs } from "../../modules/administration/AdministrationSubtabs";

export function AdministrationSectionLayout() {
  const { pathname } = useLocation();
  const showHub = isAdministrationSectionPath(pathname);

  if (!showHub) {
    return <Outlet />;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Administration & Paramètres</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Boutiques, entrepôt, rôles et permissions, paramétrage central et traçabilité complète.
          </p>
        </div>
        <AdministrationSubtabs />
      </div>
      <Outlet />
    </div>
  );
}