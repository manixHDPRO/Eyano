export const APP_THEME_IDS = ["clair", "marine", "ardoise", "sable"] as const;

export type AppThemeId = (typeof APP_THEME_IDS)[number];

export type AppTheme = {
  id: AppThemeId;
  label: string;
  swatch: string;
  chartRevenue: string;
  chartStock: string;
  grid: string;
  tick: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
};

export const APP_THEME_STORAGE_KEY = "eyano.dashboard.theme";

const THEMES: Record<AppThemeId, AppTheme> = {
  clair: {
    id: "clair",
    label: "Clair",
    swatch: "#f8fafc",
    chartRevenue: "#0f172a",
    chartStock: "#94a3b8",
    grid: "#e2e8f0",
    tick: "#64748b",
    tooltipBg: "#ffffff",
    tooltipBorder: "#e2e8f0",
    tooltipText: "#0f172a",
  },
  marine: {
    id: "marine",
    label: "Marine",
    swatch: "#000d30",
    chartRevenue: "#f47a12",
    chartStock: "#7dd3fc",
    grid: "rgba(255,255,255,0.08)",
    tick: "#94a3b8",
    tooltipBg: "#071633",
    tooltipBorder: "rgba(255,255,255,0.12)",
    tooltipText: "#f8fafc",
  },
  ardoise: {
    id: "ardoise",
    label: "Ardoise",
    swatch: "#0f172a",
    chartRevenue: "#38bdf8",
    chartStock: "#64748b",
    grid: "rgba(148,163,184,0.2)",
    tick: "#94a3b8",
    tooltipBg: "#111827",
    tooltipBorder: "rgba(148,163,184,0.3)",
    tooltipText: "#f8fafc",
  },
  sable: {
    id: "sable",
    label: "Sable",
    swatch: "#f6efe4",
    chartRevenue: "#c2410c",
    chartStock: "#d6b48c",
    grid: "#eadccb",
    tick: "#8a6a52",
    tooltipBg: "#fffdf8",
    tooltipBorder: "#e7d7c3",
    tooltipText: "#3f2a1d",
  },
};

export function appTheme(id: AppThemeId): AppTheme {
  switch (id) {
    case "clair":
    case "marine":
    case "ardoise":
    case "sable":
      return THEMES[id];
    default: {
      const unknown: never = id;
      return unknown;
    }
  }
}

export function isDarkTheme(themeId: AppThemeId): boolean {
  switch (themeId) {
    case "marine":
    case "ardoise":
      return true;
    case "clair":
    case "sable":
      return false;
    default: {
      const unknown: never = themeId;
      return unknown;
    }
  }
}

export function isAppThemeId(value: string | null): value is AppThemeId {
  return value === "clair" || value === "marine" || value === "ardoise" || value === "sable";
}

export function readStoredTheme(): AppThemeId {
  try {
    const stored = localStorage.getItem(APP_THEME_STORAGE_KEY);
    if (isAppThemeId(stored)) {
      return stored;
    }
  } catch {
    return "clair";
  }
  return "clair";
}

export function applyThemeToDocument(themeId: AppThemeId) {
  document.documentElement.dataset.theme = themeId;
  document.documentElement.style.colorScheme =
    themeId === "marine" || themeId === "ardoise" ? "dark" : "light";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const color =
      themeId === "marine" ? "#000d30" : themeId === "ardoise" ? "#0b1220" : themeId === "sable" ? "#f4efe6" : "#f8fafc";
    meta.setAttribute("content", color);
  }
}
