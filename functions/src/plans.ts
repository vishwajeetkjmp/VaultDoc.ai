import "./setup";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import { onSchedule } from "firebase-functions/v2/scheduler";

/**
 * Plans. Everyone is on Free; Pro is granted by an admin for now (online payment comes later).
 *
 *   users/{uid}.plan            "pro", or absent for Free (written only by functions)
 *   users/{uid}.planUntil       when Pro ends (absent = no end date)
 *   users/{uid}.planGrantedBy   who granted it ("expired" when the daily job ended it)
 *   users/{uid}.planUpdatedAt   changes when the plan changes; the app refreshes the login token then
 *   custom claim `plan: "pro"`  lets the Storage rules allow bigger files without reading Firestore
 *
 * Keep the storage numbers in sync with firebase/storage.rules and apps/web/lib/files/limits.ts.
 */
export type PlanId = "free" | "pro";

const MB = 1024 * 1024;
const GB = 1024 * MB;

export const PLAN_LIMITS: Record<PlanId, { aiDaily: number; aiFiles: number; aiPages: number; quotaBytes: number; maxFileBytes: number }> = {
  // Free AI and storage numbers are defaults; config/limits can change them (admin AI page, quotas)
  free: { aiDaily: 10, aiFiles: 1, aiPages: 60, quotaBytes: 1 * GB, maxFileBytes: 20 * MB },
  pro: { aiDaily: 50, aiFiles: 20, aiPages: 300, quotaBytes: 10 * GB, maxFileBytes: 50 * MB },
};

/** What Pro costs: a one-time payment for 30 days (amount in paise). Keep in sync with apps/web/lib/plans.ts. */
export const PRO_PRICE = { amount: 399_00, days: 30 };

const db = () => getFirestore();

/** The plan a user is on right now (Pro past its end date counts as Free). */
export function planOf(user?: FirebaseFirestore.DocumentSnapshot): PlanId {
  if (user?.get("plan") !== "pro") return "free";
  const until = user.get("planUntil") as Timestamp | undefined;
  return !until || until.toMillis() > Date.now() ? "pro" : "free";
}

/** Moves a user to a plan: the users/{uid} record and the login claim, keeping their other claims (admin role). */
export async function setPlan(uid: string, plan: PlanId, until: number | null, by: string) {
  const account = await getAuth().getUser(uid);
  const claims: Record<string, unknown> = { ...(account.customClaims ?? {}) };
  if (plan === "pro") claims.plan = "pro";
  else delete claims.plan;
  await getAuth().setCustomUserClaims(uid, claims);
  await db()
    .doc(`users/${uid}`)
    .set(
      plan === "pro"
        ? { plan: "pro", planUntil: until ? Timestamp.fromMillis(until) : FieldValue.delete(), planGrantedBy: by, planUpdatedAt: FieldValue.serverTimestamp() }
        : { plan: FieldValue.delete(), planUntil: FieldValue.delete(), planGrantedBy: by, planUpdatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
}

/** Ends Pro for everyone past their end date, every night just after midnight India time. */
export async function expirePlansNow(): Promise<number> {
  const due = await db().collection("users").where("planUntil", "<=", Timestamp.now()).get();
  let ended = 0;
  for (const user of due.docs) {
    if (user.get("plan") !== "pro") continue;
    await setPlan(user.id, "free", null, "expired");
    ended++;
  }
  if (ended) logger.info("Pro plans ended", { ended });
  return ended;
}

export const expirePlans = onSchedule({ schedule: "5 0 * * *", timeZone: "Asia/Kolkata" }, async () => {
  await expirePlansNow();
});
