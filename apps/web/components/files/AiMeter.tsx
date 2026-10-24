"use client";

import { useEffect, useState } from "react";
import { call } from "../../lib/callable";
import styles from "./files.module.css";

type Quota = { used: number; limit: number; plan: "free" | "pro"; enabled: boolean };

const SparkIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
    <path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" />
  </svg>
);

/** Today's AI questions, shown like the storage bar: "3 of 10 questions today · resets at midnight". */
export default function AiMeter({ compact }: { compact?: boolean }) {
  const [quota, setQuota] = useState<Quota | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    call<object, Quota>("aiQuota", {}).then(setQuota, () => setFailed(true));
  }, []);

  if (failed) return null;
  const ratio = quota && quota.limit > 0 ? Math.min(1, quota.used / quota.limit) : 0;
  const color = ratio >= 1 ? "#e5484d" : ratio >= 0.8 ? "#f59e0b" : "var(--primary)";

  return (
    <div style={{ width: "100%", textAlign: "left" }}>
      {!compact && (
        <div className={styles.meterLabel}>
          <SparkIcon />
          AI questions
        </div>
      )}
      <div className={styles.meterTrack} role="progressbar" aria-label="AI questions used today" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)}>
        <div className={styles.meterFill} style={{ width: `${quota?.used ? Math.max(ratio * 100, 1.5) : 0}%`, background: color }} />
      </div>
      <div className={styles.meterText}>
        {!quota
          ? "Loading…"
          : `${quota.used} of ${quota.limit} question${quota.limit === 1 ? "" : "s"} today · resets at midnight${quota.enabled ? "" : " · AI is off in My Space"}`}
      </div>
    </div>
  );
}
