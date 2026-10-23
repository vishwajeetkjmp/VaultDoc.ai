"use client";

import { useEffect, useRef, useState } from "react";
import { applyTheme, getStoredTheme, ThemeName, THEME_LABELS, THEMES } from "../lib/theme";
import styles from "./themeMenu.module.css";

/** Theme picker: opens on hover (or click / keyboard) with a menu of all themes and colour previews. */
export default function ThemeMenu() {
  const [theme, setTheme] = useState<ThemeName>("dark");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Opened by the mouse hovering: don't move keyboard focus into the menu then
  const byHover = useRef(false);

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  useEffect(() => {
    if (!open) return;
    // Opened by click or keyboard: focus the current theme so arrow keys start from there
    if (!byHover.current) ref.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return setOpen(false);
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const options = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? []);
      const i = options.indexOf(document.activeElement as HTMLButtonElement);
      options[(i + (e.key === "ArrowDown" ? 1 : -1) + options.length) % options.length]?.focus();
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (id: ThemeName) => {
    setTheme(id);
    applyTheme(id);
    setOpen(false);
  };

  return (
    <div
      ref={ref}
      className={styles.wrap}
      onMouseEnter={() => {
        byHover.current = true;
        setOpen(true);
      }}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        className={styles.trigger}
        // Hover already opened it, so a click only opens (toggling would close it right away)
        onClick={() => {
          byHover.current = false;
          setOpen(true);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Theme: ${THEME_LABELS[theme]}. Change theme`}
      >
        Theme
        <svg className={styles.chevron} width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m3 4.5 3 3 3-3" />
        </svg>
      </button>
      {open && (
        <div className={styles.panel} role="menu" aria-label="Themes">
          <div className={styles.heading}>Theme</div>
          {THEMES.map((t) => (
            <button
              key={t.id}
              role="menuitemradio"
              aria-checked={t.id === theme}
              className={styles.option}
              onClick={() => choose(t.id)}
            >
              <span
                className={styles.swatch}
                style={{ background: t.bg, ["--swatch-accent" as string]: t.accent }}
                aria-hidden
              />
              <span className={styles.label}>{t.label}</span>
              {t.id === theme && <span className={styles.check}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
