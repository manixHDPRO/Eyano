import {
  DASHBOARD_MODEL_IDS,
  MENU_MODEL_IDS,
  dashboardModelDescription,
  dashboardModelLabel,
  menuModelDescription,
  menuModelLabel,
} from "../presentation/presentation";
import { usePresentation } from "../presentation/PresentationProvider";

export function PresentationPage() {
  const { menu, dashboard, setMenu, setDashboard } = usePresentation();

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <fieldset className="rounded-2xl border border-slate-200 bg-white p-5">
        <legend className="px-1 text-sm font-semibold text-slate-900">Menu</legend>
        <p className="mb-4 text-sm text-slate-500">
          Le modèle s’applique tout de suite à l’administration sur cet appareil.
        </p>
        <div className="space-y-2" role="radiogroup" aria-label="Modèle de menu">
          {MENU_MODEL_IDS.map((id) => {
            const selected = menu === id;
            return (
              <label
                key={id}
                className={`flex cursor-pointer gap-3 rounded-xl border px-3 py-3 ${
                  selected ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  name="menu-model"
                  className="mt-1"
                  checked={selected}
                  onChange={() => setMenu(id)}
                />
                <span>
                  <span className="block text-sm font-medium text-slate-900">{menuModelLabel(id)}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                    {menuModelDescription(id)}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border border-slate-200 bg-white p-5">
        <legend className="px-1 text-sm font-semibold text-slate-900">Tableau de bord</legend>
        <p className="mb-4 text-sm text-slate-500">
          Les mêmes données changent d’ordre selon le modèle choisi.
        </p>
        <div className="space-y-2" role="radiogroup" aria-label="Modèle de tableau de bord">
          {DASHBOARD_MODEL_IDS.map((id) => {
            const selected = dashboard === id;
            return (
              <label
                key={id}
                className={`flex cursor-pointer gap-3 rounded-xl border px-3 py-3 ${
                  selected ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  name="dashboard-model"
                  className="mt-1"
                  checked={selected}
                  onChange={() => setDashboard(id)}
                />
                <span>
                  <span className="block text-sm font-medium text-slate-900">{dashboardModelLabel(id)}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                    {dashboardModelDescription(id)}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
