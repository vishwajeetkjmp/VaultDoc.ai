"use client";

import { useEffect, useRef, useState } from "react";
import { getFreeTools, isComingSoon } from "../lib/tools";
import styles from "./navbar.module.css";

/** "Free Tool" menu: opens on hover (desktop), click/tap, or keyboard; closes on Escape or outside click. */
export default function ToolDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const tools = getFreeTools();

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
      <button className={styles.dropdownButton} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        Free Tool ▾
      </button>
      {open && (
        <div className={styles.dropdownPanel} role="menu">
          {tools.map((tool) => (
            <a key={tool.id} href={tool.route} role="menuitem" className={styles.toolItem}>
              {tool.name}
              {isComingSoon(tool) && <span className={styles.soon}>Soon</span>}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
