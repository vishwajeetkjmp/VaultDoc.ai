"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./cloud";

const MB = 1024 * 1024;
const GB = 1024 * MB;

/**
 * Upload limits. Override any of them without a code change by creating the
 * Firestore document config/limits with the same field names (in bytes).
 * maxFileBytes and quotaBytes are also enforced by firebase/storage.rules,
 * whose fallback defaults must match these.
 */
export const DEFAULT_LIMITS = {
  maxFileBytes: 20 * MB, // per stored file
  quotaBytes: 1 * GB, // per user (can be overridden per user with users/{uid}.quotaBytes)
  maxZipBytes: 100 * MB, // a ZIP is unpacked in the browser; only its contents are stored
  maxZipEntries: 1000,
};

export type Limits = typeof DEFAULT_LIMITS;

let limitsPromise: Promise<Limits> | null = null;

export function loadLimits(): Promise<Limits> {
  limitsPromise ??= getDoc(doc(db(), "config/limits"))
    .then((snap) => ({ ...DEFAULT_LIMITS, ...(snap.exists() ? (snap.data() as Partial<Limits>) : {}) }))
    .catch(() => DEFAULT_LIMITS);
  return limitsPromise;
}

export type StorageAccount = {
  usedBytes: number;
  fileCount: number;
  quotaBytes: number;
  limits: Limits;
  loading: boolean;
};

/**
 * Live storage usage for a user (kept up to date by Cloud Functions).
 * Creates the empty usage record on first visit.
 */
export function useStorageAccount(uid: string | undefined): StorageAccount {
  const [limits, setLimits] = useState<Limits>(DEFAULT_LIMITS);
  const [account, setAccount] = useState({ usedBytes: 0, fileCount: 0, quotaBytes: null as number | null, loading: true });

  useEffect(() => {
    loadLimits().then(setLimits);
  }, []);

  useEffect(() => {
    if (!uid) return;
    const ref = doc(db(), "users", uid);
    return onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          if (!snap.metadata.fromCache) {
            setDoc(ref, { usedBytes: 0, fileCount: 0, createdAt: serverTimestamp() }).catch(() => {
              // Created by a Cloud Function in the meantime
            });
          }
          setAccount({ usedBytes: 0, fileCount: 0, quotaBytes: null, loading: snap.metadata.fromCache });
          return;
        }
        const data = snap.data();
        setAccount({
          usedBytes: Math.max(0, Number(data.usedBytes) || 0),
          fileCount: Math.max(0, Number(data.fileCount) || 0),
          quotaBytes: typeof data.quotaBytes === "number" ? data.quotaBytes : null,
          loading: false,
        });
      },
      () => setAccount((a) => ({ ...a, loading: false })),
    );
  }, [uid]);

  return {
    usedBytes: account.usedBytes,
    fileCount: account.fileCount,
    quotaBytes: account.quotaBytes ?? limits.quotaBytes,
    limits,
    loading: account.loading,
  };
}
