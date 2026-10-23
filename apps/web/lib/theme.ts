export type ThemeName = "dark" | "grey" | "light" | "clay" | "clay-dark";

/** Every theme, in menu order, with a small preview (page colour + accent) for the theme menu. */
export const THEMES: { id: ThemeName; label: string; bg: string; accent: string }[] = [
  { id: "dark", label: "Dark Blue", bg: "#0a1628", accent: "#3b82f6" },
  { id: "grey", label: "Grey", bg: "#2b2b2b", accent: "#6b7280" },
  { id: "light", label: "Off-White", bg: "#faf9f4", accent: "#d4a017" },
  { id: "clay", label: "Clay", bg: "#f5f4ed", accent: "#c96442" },
  { id: "clay-dark", label: "Clay Dark", bg: "#151515", accent: "#d77657" },
];

export const THEME_ORDER: ThemeName[] = THEMES.map((t) => t.id);

export const THEME_LABELS = Object.fromEntries(THEMES.map((t) => [t.id, t.label])) as Record<ThemeName, string>;

export const THEME_STORAGE_KEY = "vaultdocai-theme";

export function getStoredTheme(): ThemeName {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeName | null;
  return stored && THEME_ORDER.includes(stored) ? stored : "dark";
}

export function applyTheme(theme: ThemeName): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}
