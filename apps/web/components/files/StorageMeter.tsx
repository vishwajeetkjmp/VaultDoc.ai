"use client";

import { formatBytes } from "../../lib/files/format";
import { useStorageAccount } from "../../lib/files/limits";
import styles from "./files.module.css";
import { CloudIcon } from "./icons";

/** Gmail-style storage bar: "312.4 MB of 1 GB used". Turns amber at 80% and red at 95%. */
export default function StorageMeter({ uid, compact }: { uid: string; compact?: boolean }) {
  const { usedBytes, quotaBytes, fileCount, loading } = useStorageAccount(uid);
  const ratio = quotaBytes > 0 ? Math.min(1, usedBytes / quotaBytes) : 0;
  const color = ratio >= 0.95 ? "#e5484d" : ratio >= 0.8 ? "#f59e0b" : "var(--primary)";

  return (
    <div style={{ width: "100%", textAlign: "left" }}>
      {!compact && (
        <div className={styles.meterLabel}>
          <CloudIcon size={18} />
          Storage
        </div>
      )}
      <div
        className={styles.meterTrack}
        role="progressbar"
        aria-label="Storage used"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(ratio * 100)}
      >
        <div
          className={styles.meterFill}
          // Show a sliver once anything is stored, so a tiny usage doesn't look like none
          style={{ width: `${usedBytes > 0 ? Math.max(ratio * 100, 1.5) : 0}%`, background: color }}
        />
      </div>
      <div className={styles.meterText}>
        {loading ? "Loading…" : `${formatBytes(usedBytes)} of ${formatBytes(quotaBytes)} used`}
        {!loading && !compact && ` · ${fileCount} file${fileCount === 1 ? "" : "s"}`}
      </div>
    </div>
  );
}
