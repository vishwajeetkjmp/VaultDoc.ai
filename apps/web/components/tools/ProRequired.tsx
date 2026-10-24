"use client";

import Link from "next/link";
import { useAuth } from "../AuthProvider";
import { useStorageAccount } from "../../lib/files/limits";
import { PRO_PRICE_RUPEES } from "../../lib/plans";
import styles from "./tools.module.css";

/**
 * Shows the tool only to Pro members (goes inside LoginRequired, so the person is already logged in).
 * Everyone else gets a short explanation and the way to upgrade.
 */
export default function ProRequired({ toolName, children }: { toolName: string; children: React.ReactNode }) {
  const { user } = useAuth();
  const account = useStorageAccount(user?.uid);

  if (account.loading) return <div className={styles.drop} aria-busy="true" />;
  if (account.plan === "pro") return <>{children}</>;

  return (
    <div className={styles.result}>
      <div className={styles.resultIcon} style={{ background: "color-mix(in srgb, var(--primary) 16%, transparent)", color: "var(--primary)" }} aria-hidden>
        ✦
      </div>
      <div className={styles.resultTitle}>{toolName} is part of Pro</div>
      <p className={styles.muted} style={{ maxWidth: 440, textAlign: "center", margin: 0 }}>
        Pro adds {toolName}, AI answers across up to 20 files, 50 AI questions a day and 10 GB of storage. ₹{PRO_PRICE_RUPEES} for 30 days, no auto-renewal.
      </p>
      <Link href="/pricing" className={styles.primary}>
        See Pro
      </Link>
    </div>
  );
}
