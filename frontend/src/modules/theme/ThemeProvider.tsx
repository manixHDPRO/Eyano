import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { APP_THEME_IDS, APP_THEME_STORAGE_KEY, appTheme, applyThemeToDocument, readStoredTheme } from "./theme";
import type { AppTheme, AppThemeId } from "./theme";

type ThemeContextValue = {
  themeId: AppThemeId;
  theme: AppTheme;
  setTheme: (themeId: AppThemeId) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<AppThemeId>(readStoredTheme);

  useEffect(() => {
    applyThemeToDocument(themeId);
  }, [themeId]);

  function setTheme(next: AppThemeId) {
    setThemeId(next);
    try {
      localStorage.setItem(APP_THEME_STORAGE_KEY, next);
    } catch {
      /* le choix reste actif pour la session */
    }
  }

  return (
    <ThemeContext.Provider value={{ themeId, theme: appTheme(themeId), setTheme }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme doit être utilisé dans ThemeProvider.");
  }
  return context;
}

export function ThemePicker({ compact = false }: { compact?: boolean }) {
  const { themeId, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-2">
      {compact ? null : (
        <span className="hidden text-[11px] font-semibold tracking-[0.14em] text-slate-500 uppercase sm:inline">
          Thème
        </span>
      )}
      <div role="radiogroup" aria-label="Thème de l'application" className="flex items-center gap-1.5">
        {APP_THEME_IDS.map((id) => {
          const theme = appTheme(id);
          const selected = id === themeId;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              title={theme.label}
              onClick={() => setTheme(id)}
              className="dash-swatch"
              style={{ background: theme.swatch }}
            >
              <span className="sr-only">{theme.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
