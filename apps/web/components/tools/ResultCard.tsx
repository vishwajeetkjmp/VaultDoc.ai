"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../AuthProvider";
import { formatBytes } from "../../lib/files/format";
import { withNext } from "../../lib/nav";
import styles from "./tools.module.css";

const autoDownloaded = new WeakSet<Blob>();

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** "Done" card: download, start over, and the save / sign-up prompt. */
export default function ResultCard({
  blob,
  fileName,
  detail,
  onReset,
}: {
  blob: Blob;
  fileName: string;
  /** e.g. "12 pages · 1.4 MB → 380 KB" */
  detail?: string;
  onReset: () => void;
}) {
  // Start the download straight away (once per result, even when React runs effects twice)
  useEffect(() => {
    if (autoDownloaded.has(blob)) return;
    autoDownloaded.add(blob);
    downloadBlob(blob, fileName);
  }, [blob, fileName]);

  return (
    <div className={styles.result}>
      <div className={styles.resultIcon} aria-hidden>
        ✓
      </div>
      <div className={styles.resultTitle}>Your file is ready</div>
      <div className={styles.muted}>
        {fileName} · {formatBytes(blob.size)}
        {detail ? ` · ${detail}` : ""}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        <button className={styles.primary} onClick={() => downloadBlob(blob, fileName)}>
          Download again
        </button>
        <button className={styles.secondary} style={{ height: 46 }} onClick={onReset}>
          Start over
        </button>
      </div>
      <SaveOrSignUp blob={blob} fileName={fileName} />
    </div>
  );
}

// Firestore/Storage code loads only for signed-in users, keeping tool pages light for visitors
const SaveToMyFiles = dynamic(() => import("./SaveToMyFiles"), { ssr: false });

/** Signed-in users can keep the result in My Space; visitors are invited to create a free account. */
function SaveOrSignUp({ blob, fileName }: { blob: Blob; fileName: string }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  if (loading) return null;

  if (user?.emailVerified) {
    return (
      <div className={styles.cta}>
        <div className={styles.ctaTitle}>Keep a copy in My Space</div>
        <SaveToMyFiles user={user} blob={blob} fileName={fileName} />
      </div>
    );
  }

  return (
    <div className={styles.cta}>
      <div className={styles.ctaTitle}>🔒 Keep your documents safe and organised</div>
      <div className={styles.ctaText}>
        Store this and all your important papers in VaultDoc. Free 1 GB, folders, and an end-to-end encrypted Secure
        Vault.
      </div>
      <div className={styles.ctaRow}>
        {/* Comes back to this tool after signing up */}
        <Link href={withNext("/signup", pathname)} className={styles.primary} style={{ height: 40, fontSize: 15 }}>
          Create free account
        </Link>
        <span className={styles.muted}>No card needed</span>
      </div>
    </div>
  );
}
