"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getToolGroups, isComingSoon, needsLogin, needsPro } from "../../lib/tools";
import ProTag from "../ProTag";
import { useAuth } from "../AuthProvider";
import LoginMark, { LOGIN_TIP } from "../LoginMark";
import styles from "./toolCards.module.css";

/** Icon and accent colour per tool kind (the `icon` key from @vaultdocai/core). */
const KINDS: Record<string, { color: string; path: React.ReactNode }> = {
  image: {
    color: "#0ea5e9",
    path: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <circle cx="9" cy="10" r="1.8" />
        <path d="m21 16-5-5-8 9" />
      </>
    ),
  },
  doc: {
    color: "#3b82f6",
    path: (
      <>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5M9 13h6M9 17h4" />
      </>
    ),
  },
  merge: {
    color: "#8b5cf6",
    path: (
      <>
        <rect x="3" y="3" width="11" height="13" rx="2" />
        <path d="M10 8h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-3" />
      </>
    ),
  },
  reorder: {
    color: "#f59e0b",
    path: <path d="M7 4v16m0 0-3-3m3 3 3-3M17 20V4m0 0-3 3m3-3 3 3" />,
  },
  rotate: {
    color: "#10b981",
    path: (
      <>
        <path d="M20 11a8 8 0 1 0-2.3 5.7" />
        <path d="M20 4v7h-7" />
      </>
    ),
  },
  remove: {
    color: "#ef4444",
    path: (
      <>
        <path d="M4 7h16M10 11v6M14 11v6" />
        <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
      </>
    ),
  },
  edit: {
    color: "#14b8a6",
    path: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
      </>
    ),
  },
  crop: {
    color: "#ec4899",
    path: <path d="M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14" />,
  },
};

const Icon = ({ kind }: { kind: (typeof KINDS)[string] }) => (
  <span className={styles.icon} aria-hidden>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {kind.path}
    </svg>
  </span>
);

const Arrow = () => (
  <svg className={styles.arrow} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 12h14m-5-5 5 5-5 5" />
  </svg>
);

const LockIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="4" y="10.5" width="16" height="11" rx="3" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </svg>
);

/** Home page: every free tool as a card, grouped like the navbar's Free Tool menu (PDF tools, Image tools). */
export default function ToolCards() {
  const { user, loading, wasLoggedIn } = useAuth();
  const loggedIn = !!user || (loading && wasLoggedIn);
  const groups = getToolGroups();
  // Phones have no hover: a tap on a locked card shows its tooltip (tap elsewhere or Escape hides it)
  const [tipFor, setTipFor] = useState<string | null>(null);
  useEffect(() => {
    if (!tipFor) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !(e.target as HTMLElement).closest(`[data-tool="${tipFor}"]`)) setTipFor(null);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [tipFor]);

  return (
    <section className={styles.section} aria-labelledby="free-tools">
      <div className={styles.head}>
        <h2 id="free-tools" className={styles.title}>
          Free tools
        </h2>
        <p className={styles.subtitle}>Quick PDF and image tools. Files stay in your browser, nothing to install.</p>
      </div>
      {groups.map(([group, tools]) => (
        <div key={group} className={styles.group}>
          <h3 className={styles.groupTitle}>{group}</h3>
          <div className={styles.grid}>
            {tools.map((tool) => {
              const kind = KINDS[tool.id === "resize-crop-image" ? "crop" : (tool.icon ?? "doc")] ?? KINDS.doc;
              const loginTool = needsLogin(tool);
              const soon = isComingSoon(tool);
              const accent = { "--accent": kind.color } as React.CSSProperties;
              const body = (
                <span className={styles.text}>
                  <span className={styles.name}>
                    {tool.name}
                    {loginTool && <LoginMark unlocked={loggedIn} />}
                    {needsPro(tool) && <ProTag />}
                    {soon && <span className={styles.soon}>Soon</span>}
                  </span>
                  {tool.description && <span className={styles.desc}>{tool.description}</span>}
                </span>
              );

              if (loginTool && !loggedIn) {
                // Locked: not a link. Hover/focus (or a tap on phones) explains, with a way to log in
                const tipId = `tip-${tool.id}`;
                return (
                  <div
                    key={tool.id}
                    data-tool={tool.id}
                    role="button"
                    tabIndex={0}
                    aria-disabled="true"
                    aria-describedby={tipId}
                    aria-expanded={tipFor === tool.id}
                    className={`${styles.card} ${styles.locked} ${tipFor === tool.id ? styles.tipOpen : ""}`}
                    style={accent}
                    onClick={() => setTipFor((t) => (t === tool.id ? null : tool.id))}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setTipFor((t) => (t === tool.id ? null : tool.id)))}
                  >
                    <Icon kind={kind} />
                    <span className={`${styles.text} ${styles.lockedText}`}>
                      <span className={styles.name}>
                        {tool.name}
                        <LoginMark unlocked={false} />
                        {needsPro(tool) && <ProTag />}
                      </span>
                      {tool.description && <span className={styles.desc}>{tool.description}</span>}
                      <span id={tipId} role="tooltip" className={styles.tip}>
                        <Link
                          href={`/login?next=${encodeURIComponent(tool.route)}`}
                          className={styles.tipLink}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`${LOGIN_TIP}: ${tool.name} is free with an account`}
                        >
                          <LockIcon size={12} /> Log in to use
                        </Link>
                      </span>
                    </span>
                    <span className={styles.lockBadge} aria-hidden>
                      <LockIcon />
                    </span>
                  </div>
                );
              }

              return (
                <Link key={tool.id} href={tool.route} className={styles.card} style={accent} aria-label={`${tool.name}${tool.description ? `: ${tool.description}` : ""}`}>
                  <Icon kind={kind} />
                  {body}
                  <Arrow />
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
