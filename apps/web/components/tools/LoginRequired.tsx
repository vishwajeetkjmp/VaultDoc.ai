"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../AuthProvider";
import { withNext } from "../../lib/nav";
import styles from "./tools.module.css";

/**
 * Shows the tool only to logged-in users with a verified email; everyone else gets a
 * short explanation and the way in. The converter function checks the same thing.
 */
export default function LoginRequired({ toolName, children }: { toolName: string; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  if (loading) return <div className={styles.drop} aria-busy="true" />;
  if (user?.emailVerified) return <>{children}</>;

  const verify = !!user; // logged in, but the email isn't verified yet
  return (
    <div className={styles.result}>
      <div className={styles.resultIcon} style={{ background: "color-mix(in srgb, #e5484d 16%, transparent)", color: "#e5484d" }} aria-hidden>
        🔒
      </div>
      <div className={styles.resultTitle}>{verify ? "Verify your email to continue" : `Log in to use ${toolName}`}</div>
      <p className={styles.muted} style={{ maxWidth: 440, textAlign: "center", margin: 0 }}>
        {verify
          ? "We sent you a link when you signed up. Verify your email, then come back to this page."
          : "This tool runs on our secure server, so it's free with a VaultDoc account. Creating one takes a minute, no card needed."}
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        {verify ? (
          <Link href="/dashboard" className={styles.primary}>
            Verify email
          </Link>
        ) : (
          <>
            <Link href={withNext("/login", pathname)} className={styles.primary}>
              Login
            </Link>
            <Link href={withNext("/signup", pathname)} className={styles.secondary} style={{ height: 46 }}>
              Create free account
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
