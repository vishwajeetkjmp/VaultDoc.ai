"use client";

import Link from "next/link";
import { useNextParam, withNext } from "../../lib/nav";
import styles from "./auth.module.css";

/** Shared frame for the login, sign-up and password-reset pages: way back home, brand, and the tabs. */
export default function AuthShell({
  active,
  children,
}: {
  /** null hides the Login / Create account tabs */
  active: "login" | "signup" | null;
  children: React.ReactNode;
}) {
  // Switching between Login and Create account keeps the page to return to
  const next = useNextParam();
  return (
    <div className={styles.page}>
      <Link href="/" className={styles.homeLink}>
        ← Home
      </Link>

      <div className={styles.card}>
        <Link href="/" className={styles.brand} aria-label="VaultDocAI home">
          <span className={styles.logo}>🔒</span>
          <span className={styles.title}>VaultDocAI</span>
        </Link>
        <p className={styles.subtitle} style={{ textAlign: "center" }}>
          AI-powered analysis for your documents
        </p>

        {active && (
          <nav className={styles.tabs} aria-label="Login or create account">
            <Link
              href={withNext("/login", next)}
              className={active === "login" ? styles.tabActive : styles.tab}
              aria-current={active === "login" ? "page" : undefined}
            >
              Login
            </Link>
            <Link
              href={withNext("/signup", next)}
              className={active === "signup" ? styles.tabActive : styles.tab}
              aria-current={active === "signup" ? "page" : undefined}
            >
              Create account
            </Link>
          </nav>
        )}

        {children}
      </div>
    </div>
  );
}

/** Round button with just the Google "G" (label kept for screen readers and as a tooltip). */
export function GoogleButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <>
      <div className={styles.divider}>OR</div>
      <div className={styles.googleRow}>
        <button
          type="button"
          className={styles.googleButton}
          onClick={onClick}
          disabled={loading}
          aria-label="Continue with Google"
          title="Continue with Google"
        >
          {loading ? <span className={styles.spinner} /> : <GoogleIcon />}
        </button>
      </div>
    </>
  );
}

function GoogleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.4 5.4 2.5 13.3l7.8 6.1C12.2 13.3 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.5c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7c4.3-4 6.9-9.9 6.9-17.3z" />
      <path fill="#FBBC05" d="M10.3 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-7.8-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.5 10.7l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.2 0 11.5-2 15.3-5.5l-7.3-5.7c-2 1.4-4.7 2.3-8 2.3-6.4 0-11.8-3.8-13.7-9.1l-7.8 6.1C6.4 42.6 14.6 48 24 48z" />
    </svg>
  );
}
