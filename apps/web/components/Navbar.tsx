"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ToolDropdown from "./ToolDropdown";
import ThemeMenu from "./ThemeMenu";
import ProfileMenu from "./ProfileMenu";
import { useAuth } from "./AuthProvider";
import { getToolGroups, isComingSoon, needsPro, toolLock } from "../lib/tools";
import { usePlan } from "../lib/plan";
import ProTag from "./ProTag";
import { applyTheme, getStoredTheme, ThemeName, THEMES } from "../lib/theme";
import { withNext } from "../lib/nav";
import styles from "./navbar.module.css";

/** Site navbar. Below 900px the middle links move into a menu button so the bar always fits the screen. */
export default function Navbar() {
  const { user, loading, wasLoggedIn } = useAuth();
  // While Firebase checks the session, lay the bar out as it looked last time, so nothing shifts
  const showMySpace = !!user || (loading && wasLoggedIn);
  const pathname = usePathname();
  const plan = usePlan();
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeName>("dark");
  // Tool groups opened in the phone menu (all closed at first)
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (menuOpen) setTheme(getStoredTheme());
  }, [menuOpen]);

  // Pages now change without a reload, so close the phone menu when the page changes
  useEffect(() => setMenuOpen(false), [pathname]);

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
      <Link href="/" className={styles.brand} aria-label="VaultDocAI home">
        <BrandMark />
        VaultDocAI
      </Link>

      <div className={styles.links}>
        <ToolDropdown />
        <Link href="/pricing" className={styles.link}>
          Pricing
        </Link>
        <Link href="/about" className={styles.link}>
          About
        </Link>
        {showMySpace && (
          <Link
            href="/dashboard"
            className={pathname.startsWith("/dashboard") ? `${styles.mySpace} ${styles.mySpaceActive}` : styles.mySpace}
            style={{ visibility: user ? "visible" : "hidden" }}
          >
            <MySpaceLabel />
          </Link>
        )}
      </div>

      <div className={styles.right}>
        <div className={styles.desktopOnly}>
          <ThemeMenu />
        </div>
        {/* Until Firebase reports whether someone is logged in, keep the space empty so nothing flashes or jumps */}
        {loading && <span className={wasLoggedIn ? styles.avatarPlaceholder : styles.authPlaceholder} aria-hidden />}
        {/* With the phone menu open, Login and Sign Up sit at the bottom of the menu instead */}
        {!loading && !user && (
          <span className={menuOpen ? `${styles.authArea} ${styles.hiddenWhileMenu}` : styles.authArea}>
            <Link href={withNext("/login", pathname)} className={styles.signIn}>
              Login
            </Link>
            <Link href={withNext("/signup", pathname)} className={styles.signUp}>
              Sign Up
            </Link>
          </span>
        )}
        {user && (
          <span className={styles.authArea}>
            <ProfileMenu user={user} />
          </span>
        )}
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
        // Tools fold into groups so the list stays short; Login / Sign Up stay pinned at the bottom
        <div className={styles.mobilePanel}>
          <div className={styles.mobileBody}>
            {user && (
              <>
                <Link href="/dashboard" className={styles.mobileLink}>
                  <MySpaceLabel />
                </Link>
                <Link href="/vault" className={styles.mobileLink}>
                  🔐 Secure Vault
                </Link>
                <div className={styles.mobileDivider} />
              </>
            )}
            {getToolGroups().map(([group, tools]) => {
              const open = openGroups.includes(group);
              const id = `menu-${group.replace(/\W+/g, "-").toLowerCase()}`;
              return (
                <div key={group}>
                  <button
                    type="button"
                    className={styles.mobileGroup}
                    aria-expanded={open}
                    aria-controls={id}
                    onClick={() => setOpenGroups((g) => (open ? g.filter((x) => x !== group) : [...g, group]))}
                  >
                    <svg className={open ? styles.chevronOpen : styles.chevron} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="m9 6 6 6-6 6" />
                    </svg>
                    {group}
                    <span className={styles.mobileCount}>{tools.length}</span>
                  </button>
                  {open && (
                    <ul id={id} className={styles.mobileToolList}>
                      {tools.map((tool) => (
                        <li key={tool.id}>
                          {(() => {
                            const lock = toolLock(tool, !!user, plan);
                            const name = (
                              <span>
                                {tool.name}
                                {needsPro(tool) && <ProTag />}
                              </span>
                            );
                            // Phones have no hover, so the reason is written under the locked tool
                            return lock ? (
                              <Link href={lock.href} className={`${styles.mobileTool} ${styles.mobileLinkLocked}`} aria-label={`${tool.name}: ${lock.tip}`}>
                                {name}
                                <span className={lock.kind === "pro" ? styles.upgradeHint : styles.lockedNote}>
                                  {lock.kind === "pro" ? `🔒 ${lock.short}` : lock.short}
                                </span>
                              </Link>
                            ) : (
                              <Link href={tool.route} className={styles.mobileTool}>
                                {name}
                                {isComingSoon(tool) && <span className={styles.soon}>Soon</span>}
                              </Link>
                            );
                          })()}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
            <div className={styles.mobileDivider} />
            <Link href="/pricing" className={styles.mobileLink}>
              Pricing
            </Link>
            <Link href="/about" className={styles.mobileLink}>
              About
            </Link>
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
          </div>
          {!user && !loading && (
            <div className={styles.mobileAuth}>
              <Link href={withNext("/login", pathname)} className={styles.mobileLogin}>
                Login
              </Link>
              <Link href={withNext("/signup", pathname)} className={styles.mobileSignUp}>
                Sign Up
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}

/** "My Space" with a folder icon: the logged-in user's way into their files. */
function MySpaceLabel() {
  return (
    <span className={styles.mySpaceLabel}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      </svg>
      My Space
    </span>
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
