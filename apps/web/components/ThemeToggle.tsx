"use client";

import { useEffect, useState } from "react";
import {
  ThemeName,
  getStoredTheme,
  applyTheme,
  getNextTheme,
  THEME_LABELS,
} from "../lib/theme";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeName>("dark");

  useEffect(() => {
    const stored = getStoredTheme();
    setTheme(stored);
    applyTheme(stored);
  }, []);

  function handleToggle() {
    const next = getNextTheme(theme);
    setTheme(next);
    applyTheme(next);
  }

  return (
    <button
      onClick={handleToggle}
      aria-label="Toggle theme"
      style={{
        background: "var(--bg-elevated)",
        color: "var(--text)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "8px 14px",
        fontSize: "14px",
        fontWeight: 500,
      }}
    >
      🎨 {THEME_LABELS[theme]}
    </button>
  );
}