export type ThemeName = "dark" | "grey" | "light";

export const THEME_ORDER: ThemeName[] = ["dark", "grey", "light"];

export const THEME_LABELS: Record<ThemeName, string> = {
  dark: "Dark Blue",
  grey: "Grey",
  light: "Off-White",
};

const STORAGE_KEY = "vaultdocai-theme";

export function getStoredTheme(): ThemeName {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeName | null;
  return stored && THEME_ORDER.includes(stored) ? stored : "dark";
}

export function applyTheme(theme: ThemeName): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  window.localStorage.setItem(STORAGE_KEY, theme);
}

export function getNextTheme(current: ThemeName): ThemeName {
  const idx = THEME_ORDER.indexOf(current);
  return THEME_ORDER[(idx + 1) % THEME_ORDER.length];
}