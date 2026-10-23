"use client";

import { useEffect, useRef, useState } from "react";
import ToolDropdown from "./ToolDropdown";
import ThemeMenu from "./ThemeMenu";
import ProfileMenu from "./ProfileMenu";
import { useAuth } from "./AuthProvider";
import { getFreeTools, isComingSoon } from "../lib/tools";
import { applyTheme, getStoredTheme, ThemeName, THEMES } from "../lib/theme";
import styles from "./navbar.module.css";

/** Site navbar. Below 900px the middle links move into a menu button so the bar always fits the screen. */
export default function Navbar() {
  const { user, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeName>("dark");
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (menuOpen) setTheme(getStoredTheme());
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => !navRef.current?.contains(e.target as Node) && setMenuOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    const onResize = () => window.innerWidth > 900 && setMenuOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [menuOpen]);

  return (
    <nav ref={navRef} className={styles.nav}>
      <a href="/" className={styles.brand} aria-label="VaultDocAI home">
        <BrandMark />
        VaultDocAI
      </a>

      <div className={styles.links}>
        <ToolDropdown />
        <a href="/pricing" className={styles.link}>
          Pricing
        </a>
        <a href="/about" className={styles.link}>
          About
        </a>
      </div>

      <div className={styles.right}>
        <div className={styles.desktopOnly}>
          <ThemeMenu />
        </div>
        {/* Hide auth links until Firebase reports whether someone is signed in, to avoid a flash */}
        {!loading && !user && (
          <>
            <a href="/signin" className={styles.signIn}>
              Sign In
            </a>
            <a href="/signup" className={styles.signUp}>
              Sign Up
            </a>
          </>
        )}
        {user && <ProfileMenu user={user} />}
        <button
          className={styles.menuButton}
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
        >
          {menuOpen ? "✕" : "☰"}
        </button>
      </div>

      {menuOpen && (
        <div className={styles.mobilePanel}>
          <div className={styles.mobileHeading}>Free tools</div>
          {getFreeTools().map((tool) => (
            <a key={tool.id} href={tool.route} className={styles.mobileLink}>
              {tool.name}
              {isComingSoon(tool) && <span className={styles.soon}>Soon</span>}
            </a>
          ))}
          <div className={styles.mobileDivider} />
          <a href="/pricing" className={styles.mobileLink}>
            Pricing
          </a>
          <a href="/about" className={styles.mobileLink}>
            About
          </a>
          <div className={styles.mobileDivider} />
          <div className={styles.mobileHeading}>Theme</div>
          <div className={styles.mobileThemes}>
            {THEMES.map((t) => (
              <button
                key={t.id}
                className={t.id === theme ? styles.mobileThemeActive : styles.mobileTheme}
                aria-pressed={t.id === theme}
                onClick={() => {
                  applyTheme(t.id);
                  setTheme(t.id);
                }}
              >
                <span className={styles.mobileSwatch} style={{ background: t.bg, borderColor: t.accent }} aria-hidden />
                {t.label}
              </button>
            ))}
          </div>
          <div className={styles.mobileDivider} />
          {user ? (
            <>
              <a href="/dashboard" className={styles.mobileLink}>
                My Files
              </a>
              <a href="/vault" className={styles.mobileLink}>
                🔐 Secure Vault
              </a>
            </>
          ) : (
            <a href="/signin" className={styles.mobileLink}>
              Sign In
            </a>
          )}
        </div>
      )}
    </nav>
  );
}

/** Small padlock-and-spark mark in the accent colour, shown before the wordmark. */
function BrandMark() {
  return (
    <svg className={styles.brandMark} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="10.5" width="16" height="11" rx="3" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
      <circle cx="12" cy="16" r="1.4" fill="currentColor" />
    </svg>
  );
}
