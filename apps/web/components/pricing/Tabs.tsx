"use client";

import { KeyboardEvent } from "react";
import styles from "./pricing.module.css";

/** The pill-shaped tab switcher used for plan types, billing period and FAQ groups (arrow keys move between tabs). */
export default function Tabs({
  label,
  idPrefix,
  tabs,
  value,
  onChange,
}: {
  label: string;
  idPrefix: string;
  tabs: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const i = tabs.findIndex((t) => t.id === value);
    const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    onChange(next.id);
    document.getElementById(`${idPrefix}-tab-${next.id}`)?.focus();
  }

  return (
    <div className={styles.tabsWrap}>
      <div className={styles.tabsTrack} role="tablist" aria-label={label} onKeyDown={onKeyDown}>
        {tabs.map((t) => (
          <button
            key={t.id}
            id={`${idPrefix}-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={t.id === value}
            aria-controls={`${idPrefix}-panel`}
            tabIndex={t.id === value ? 0 : -1}
            className={styles.tab}
            onClick={() => onChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
