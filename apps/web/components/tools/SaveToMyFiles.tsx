"use client";

import { useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { ROOT_FOLDER } from "../../lib/files/items";
import { useStorageAccount } from "../../lib/files/limits";
import { uploadQueue, useUploads } from "../../lib/files/uploader";
import styles from "./tools.module.css";

/** Uploads a tool's result into the top level of My Files, with inline progress. */
export default function SaveToMyFiles({ user, blob, fileName }: { user: User; blob: Blob; fileName: string }) {
  const account = useStorageAccount(user.uid);
  const uploads = useUploads();
  const [started, setStarted] = useState(false);

  const mine = useMemo(
    () => (started ? [...uploads].reverse().find((u) => u.name === fileName) ?? null : null),
    [uploads, started, fileName],
  );

  const save = () => {
    setStarted(true);
    uploadQueue.addFiles([new File([blob], fileName, { type: blob.type })], {
      uid: user.uid,
      folder: ROOT_FOLDER,
      account: () => ({ usedBytes: account.usedBytes, quotaBytes: account.quotaBytes, limits: account.limits }),
    });
  };

  return (
    <div className={styles.ctaRow}>
      {!mine ? (
        <button className={styles.primary} style={{ height: 40, fontSize: 15 }} onClick={save}>
          Save to My Files
        </button>
      ) : mine.state === "done" ? (
        <>
          <span>✅ Saved.</span>
          <a href="/dashboard" className={styles.secondary}>
            Open My Files
          </a>
        </>
      ) : mine.state === "failed" || mine.state === "skipped" ? (
        <span className={styles.muted}>{mine.message ?? "Couldn't save"}</span>
      ) : (
        <span className={styles.muted}>Saving… {Math.round(mine.progress * 100)}%</span>
      )}
    </div>
  );
}
