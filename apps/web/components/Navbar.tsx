"use client";

import { useEffect, useRef, useState } from "react";
import ToolDropdown from "./ToolDropdown";
import ThemeMenu from "./ThemeMenu";
import ProfileMenu from "./ProfileMenu";
import { useAuth } from "./AuthProvider";
import { getFreeTools, isComingSoon } from "../lib/tools";
import styles from "./navbar.module.css";

/** Site navbar. Below 900px the middle links move into a menu button so the bar always fits the screen. */
export default function Navbar() {
  const { user, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

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
      <a href="/" className={styles.brand}>
        <span style={{ color: "var(--primary)" }}>🔒</span>
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
        <ThemeMenu />
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
