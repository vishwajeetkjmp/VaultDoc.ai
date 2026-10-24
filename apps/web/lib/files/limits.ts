"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, Timestamp } from "firebase/firestore";
import { auth } from "../firebase";
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

/** Pro storage (keep in sync with functions/src/plans.ts and firebase/storage.rules). */
export const PRO_LIMITS = { maxFileBytes: 50 * MB, quotaBytes: 10 * GB };
export type PlanId = "free" | "pro";

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
  plan: PlanId;
  /** When Pro ends (null = no end date, or Free) */
  planUntil: Date | null;
};

/** Pro, unless it has ended (same rule as planOf in functions/src/plans.ts). */
function planFrom(data: Record<string, unknown>): { plan: PlanId; planUntil: Date | null } {
  const until = data.planUntil instanceof Timestamp ? data.planUntil.toDate() : null;
  return data.plan === "pro" && (!until || until.getTime() > Date.now()) ? { plan: "pro", planUntil: until } : { plan: "free", planUntil: null };
}

/** The Storage rules read the plan from the login token: refresh it when the plan just changed. */
async function syncPlanClaim(plan: PlanId) {
  const user = auth.currentUser;
  if (!user) return;
  const token = await user.getIdTokenResult();
  if ((token.claims.plan === "pro" ? "pro" : "free") !== plan) await user.getIdToken(true);
}

/**
 * Live storage usage for a user (kept up to date by Cloud Functions).
 * Creates the empty usage record on first visit.
 */
export function useStorageAccount(uid: string | undefined): StorageAccount {
  const [limits, setLimits] = useState<Limits>(DEFAULT_LIMITS);
  const [account, setAccount] = useState({ usedBytes: 0, fileCount: 0, quotaBytes: null as number | null, loading: true, plan: "free" as PlanId, planUntil: null as Date | null });

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
          setAccount({ usedBytes: 0, fileCount: 0, quotaBytes: null, loading: snap.metadata.fromCache, plan: "free", planUntil: null });
          return;
        }
        const data = snap.data();
        const plan = planFrom(data);
        setAccount({
          usedBytes: Math.max(0, Number(data.usedBytes) || 0),
          fileCount: Math.max(0, Number(data.fileCount) || 0),
          quotaBytes: typeof data.quotaBytes === "number" ? data.quotaBytes : null,
          loading: false,
          ...plan,
        });
        if (!snap.metadata.fromCache) syncPlanClaim(plan.plan).catch(() => undefined);
      },
      () => setAccount((a) => ({ ...a, loading: false })),
    );
  }, [uid]);

  const pro = account.plan === "pro";
  return {
    usedBytes: account.usedBytes,
    fileCount: account.fileCount,
    // An admin's per-user quota wins over both plans (same as onFileUploaded)
    quotaBytes: account.quotaBytes ?? (pro ? PRO_LIMITS.quotaBytes : limits.quotaBytes),
    limits: pro ? { ...limits, maxFileBytes: PRO_LIMITS.maxFileBytes, quotaBytes: PRO_LIMITS.quotaBytes } : limits,
    loading: account.loading,
    plan: account.plan,
    planUntil: account.planUntil,
  };
}
