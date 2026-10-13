export const THEME_STORAGE_KEY = "office-pulse-theme";

export type Theme = "light" | "dark";

export function isTheme(value: string | null | undefined): value is Theme {
  return value === "light" || value === "dark";
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

export function readThemeFromDocument(): Theme {
  const attr = document.documentElement.getAttribute("data-theme");
  return isTheme(attr) ? attr : "dark";
}

/** Read explicit user preference from localStorage (null if unset/unavailable). */
export function readStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : null;
  } catch {
    return null;
  }
}

/**
 * Resolve theme from the same sources as themeInitScript.
 * Prefer localStorage (survives React Strict Mode clearing data-theme on
 * <html> in dev), then system preference, then dark.
 * Do not trust the document attribute — Strict Mode remounts reset it to the
 * server JSX default.
 */
export function resolveClientTheme(): Theme {
  const stored = readStoredTheme();
  if (stored) return stored;

  try {
    if (window.matchMedia("(prefers-color-scheme: light)").matches) {
      return "light";
    }
  } catch {
    // ignore
  }
  return "dark";
}

export function persistTheme(theme: Theme) {
  applyTheme(theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage may be blocked; attribute still applied for this session.
  }
}

/** Inline script for layout: apply theme before paint to avoid flash. */
export const themeInitScript = `(function(){try{var k="${THEME_STORAGE_KEY}";var t=localStorage.getItem(k);var d=t==="light"||t==="dark"?t:(window.matchMedia("(prefers-color-scheme:light)").matches?"light":"dark");document.documentElement.setAttribute("data-theme",d);}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`;
