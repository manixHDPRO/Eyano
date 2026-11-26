export const MENU_MODEL_IDS = ["accordion", "rail", "top", "glace", "atelier"] as const;
export const DASHBOARD_MODEL_IDS = ["pilotage", "jour", "stock", "glace", "atelier"] as const;

export type MenuModelId = (typeof MENU_MODEL_IDS)[number];
export type DashboardModelId = (typeof DASHBOARD_MODEL_IDS)[number];

export const MENU_STORAGE_KEY = "eyano.admin.menu";
export const DASHBOARD_STORAGE_KEY = "eyano.admin.dashboard";

export function menuModelLabel(id: MenuModelId): string {
  switch (id) {
    case "accordion":
      return "Accordéon";
    case "rail":
      return "Rail d’icônes";
    case "top":
      return "Barre haute";
    case "glace":
      return "Glacé";
    case "atelier":
      return "Atelier";
    default: {
      const unknown: never = id;
      return unknown;
    }
  }
}

export function menuModelDescription(id: MenuModelId): string {
  switch (id) {
    case "accordion":
      return "Groupes repliables dans la barre gauche. Toutes les pages restent à portée.";
    case "rail":
      return "Une colonne d’icônes. Le détail du groupe s’ouvre à côté.";
    case "top":
      return "Les groupes passent sous l’en-tête. La page utilise toute la largeur.";
    case "glace":
      return "Panneau flottant en verre dépoli, flou et liseré lumineux.";
    case "atelier":
      return "Colonne nuit, numéros et filet orange. Lecture plus graphique.";
    default: {
      const unknown: never = id;
      return unknown;
    }
  }
}

export function dashboardModelLabel(id: DashboardModelId): string {
  switch (id) {
    case "pilotage":
      return "Pilotage";
    case "jour":
      return "Journée";
    case "stock":
      return "Réseau stock";
    case "glace":
      return "Glacé";
    case "atelier":
      return "Atelier";
    default: {
      const unknown: never = id;
      return unknown;
    }
  }
}

export function dashboardModelDescription(id: DashboardModelId): string {
  switch (id) {
    case "pilotage":
      return "Chiffre d’affaires, boutiques, alertes, ventes et transferts.";
    case "jour":
      return "Sessions de caisse, dépenses du jour et dernières ventes devant.";
    case "stock":
      return "Ruptures, transferts et entrepôt devant le chiffre d’affaires.";
    case "glace":
      return "Les cartes deviennent translucides, posées sur un voile de lumière.";
    case "atelier":
      return "Un grand chiffre en vedette, puis une grille asymétrique.";
    default: {
      const unknown: never = id;
      return unknown;
    }
  }
}

export function isMenuModelId(value: string | null): value is MenuModelId {
  return MENU_MODEL_IDS.some((id) => id === value);
}

export function isDashboardModelId(value: string | null): value is DashboardModelId {
  return DASHBOARD_MODEL_IDS.some((id) => id === value);
}

export function readStoredMenuModel(): MenuModelId {
  try {
    const value = localStorage.getItem(MENU_STORAGE_KEY);
    return isMenuModelId(value) ? value : "accordion";
  } catch {
    return "accordion";
  }
}

export function readStoredDashboardModel(): DashboardModelId {
  try {
    const value = localStorage.getItem(DASHBOARD_STORAGE_KEY);
    return isDashboardModelId(value) ? value : "pilotage";
  } catch {
    return "pilotage";
  }
}
