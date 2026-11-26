import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import {
  DASHBOARD_STORAGE_KEY,
  MENU_STORAGE_KEY,
  readStoredDashboardModel,
  readStoredMenuModel,
} from "./presentation";
import type { DashboardModelId, MenuModelId } from "./presentation";

type PresentationContextValue = {
  menu: MenuModelId;
  dashboard: DashboardModelId;
  setMenu: (menu: MenuModelId) => void;
  setDashboard: (dashboard: DashboardModelId) => void;
};

const PresentationContext = createContext<PresentationContextValue | null>(null);

export function PresentationProvider({ children }: { children: ReactNode }) {
  const [menu, setMenuState] = useState<MenuModelId>(readStoredMenuModel);
  const [dashboard, setDashboardState] = useState<DashboardModelId>(readStoredDashboardModel);

  function setMenu(next: MenuModelId) {
    setMenuState(next);
    try {
      localStorage.setItem(MENU_STORAGE_KEY, next);
    } catch {
      /* le choix reste actif pour la session */
    }
  }

  function setDashboard(next: DashboardModelId) {
    setDashboardState(next);
    try {
      localStorage.setItem(DASHBOARD_STORAGE_KEY, next);
    } catch {
      /* le choix reste actif pour la session */
    }
  }

  return (
    <PresentationContext.Provider value={{ menu, dashboard, setMenu, setDashboard }}>
      {children}
    </PresentationContext.Provider>
  );
}

export function usePresentation(): PresentationContextValue {
  const context = useContext(PresentationContext);
  if (!context) {
    throw new Error("usePresentation doit être utilisé dans PresentationProvider.");
  }
  return context;
}
