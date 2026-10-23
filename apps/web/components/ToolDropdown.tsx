"use client";

import { useEffect, useRef, useState } from "react";
import { getToolGroups, isComingSoon } from "../lib/tools";
import styles from "./navbar.module.css";

/** "Free Tool" menu, grouped (PDF tools / Image tools). Opens on hover, click/tap or keyboard. */
export default function ToolDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const groups = getToolGroups();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={styles.dropdown} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      {/* Hover already opens it, so a click only opens too (toggling would close it right away) */}
      <button className={styles.dropdownButton} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(true)}>
        Free Tool
        <svg className={styles.chevron} width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m3 4.5 3 3 3-3" />
        </svg>
      </button>
      {open && (
        <div className={styles.megaPanel} role="menu">
          {groups.map(([group, tools]) => (
            <div key={group} className={styles.megaColumn}>
              <div className={styles.megaHeading}>{group}</div>
              <div className={tools.length > 4 ? styles.megaGrid : undefined}>
                {tools.map((tool) => (
                  <a key={tool.id} href={tool.route} role="menuitem" className={styles.megaItem}>
                    <span className={styles.megaName}>
                      {tool.name}
                      {isComingSoon(tool) && <span className={styles.soon}>Soon</span>}
                    </span>
                    {tool.description && <span className={styles.megaDesc}>{tool.description}</span>}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
