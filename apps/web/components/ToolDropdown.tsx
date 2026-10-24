"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { getToolGroups, isComingSoon, needsPro, toolLock } from "../lib/tools";
import { usePlan } from "../lib/plan";
import ProTag from "./ProTag";
import { useAuth } from "./AuthProvider";
import styles from "./navbar.module.css";

/** "Free Tool" menu, grouped (PDF tools / Image tools). Opens on hover, click/tap or keyboard. */
export default function ToolDropdown() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close after picking a tool (pages change without a reload now)
  useEffect(() => setOpen(false), [pathname]);
  const ref = useRef<HTMLDivElement>(null);
  const groups = getToolGroups();
  const { user, loading, wasLoggedIn } = useAuth();
  // Before Firebase answers, assume last visit's state so locked tools don't flicker
  const loggedIn = !!user || (loading && wasLoggedIn);
  const plan = usePlan();

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
                {tools.map((tool) => {
                  const lock = toolLock(tool, loggedIn, plan);
                  const name = (
                    <span className={styles.megaName}>
                      <span>
                        {tool.name}
                        {needsPro(tool) && <ProTag />}
                      </span>
                      {isComingSoon(tool) && <span className={styles.soon}>Soon</span>}
                    </span>
                  );
                  const desc = tool.description && <span className={styles.megaDesc}>{tool.description}</span>;
                  // Locked: dimmed, hovering explains why, and a click goes where it can be unlocked (log in or Pricing)
                  return lock ? (
                    <Link key={tool.id} href={lock.href} role="menuitem" className={`${styles.megaItem} ${styles.megaItemLocked}`} data-tip={lock.tip} aria-label={`${tool.name}: ${lock.tip}`}>
                      {name}
                      {desc}
                      {lock.kind === "pro" && <span className={styles.upgradeHint}>🔒 {lock.short}</span>}
                    </Link>
                  ) : (
                    <Link key={tool.id} href={tool.route} role="menuitem" className={styles.megaItem}>
                      {name}
                      {desc}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
