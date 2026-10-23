import "./setup";
import { getAuth } from "firebase-admin/auth";
import { AggregateField, FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import { onSchedule } from "firebase-functions/v2/scheduler";

/** India date (yyyy-mm-dd), so "today" in the admin panel matches the user's calendar. */
export const istDay = (d = new Date()) => new Date(d.getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10);

/**
 * Adds to today's counters in statsDaily/{yyyy-mm-dd} (shares, opens, downloads, conversions...).
 * Best effort: a failed counter must never fail the user's action.
 */
export function bumpDaily(counts: Record<string, number>): Promise<void> {
  const fields = Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, FieldValue.increment(v)]));
  return getFirestore()
    .doc(`statsDaily/${istDay()}`)
    .set({ ...fields, day: istDay() }, { merge: true })
    .then(() => undefined)
    .catch((e) => logger.warn("Daily counter failed", e));
}


export type CurrentStats = {
  users: number;
  verified: number;
  disabled: number;
  google: number;
  newUsers7: number;
  newUsers30: number;
  activeUsers7: number;
  storageBytes: number;
  files: number;
  sharesActive: number;
  at: number;
};

/**
 * Totals for the admin overview, computed in one pass: login accounts are paged 1,000 at a time,
 * storage and shares use Firestore aggregation queries (one cheap read each, however many users).
 * Writes stats/current and each day's sign-ups into statsDaily, so the overview reads a few
 * small documents instead of scanning everything.
 */
export async function computeStats(): Promise<CurrentStats> {
  const db = getFirestore();
  const now = Date.now();
  const DAY = 86_400_000;
  let users = 0, verified = 0, disabled = 0, google = 0, newUsers7 = 0, newUsers30 = 0, activeUsers7 = 0;
  const signupsByDay = new Map<string, number>();

  let pageToken: string | undefined;
  do {
    const page = await getAuth().listUsers(1000, pageToken);
    for (const u of page.users) {
      users++;
      if (u.emailVerified) verified++;
      if (u.disabled) disabled++;
      if (u.providerData.some((p) => p.providerId === "google.com")) google++;
      const created = Date.parse(u.metadata.creationTime);
      if (now - created < 7 * DAY) newUsers7++;
      if (now - created < 30 * DAY) {
        newUsers30++;
        const day = istDay(new Date(created));
        signupsByDay.set(day, (signupsByDay.get(day) ?? 0) + 1);
      }
      const last = Date.parse(u.metadata.lastRefreshTime ?? u.metadata.lastSignInTime ?? "");
      if (last && now - last < 7 * DAY) activeUsers7++;
    }
    pageToken = page.pageToken;
  } while (pageToken);

  // One field per aggregation: summing two fields in one query would need a composite index
  const [bytesAgg, filesAgg, noExpiry, notExpired] = await Promise.all([
    db.collection("users").aggregate({ bytes: AggregateField.sum("usedBytes") }).get(),
    db.collection("users").aggregate({ files: AggregateField.sum("fileCount") }).get(),
    db.collection("shares").where("expiresAt", "==", null).count().get(),
    db.collection("shares").where("expiresAt", ">", Timestamp.fromMillis(now)).count().get(),
  ]);

  const stats: CurrentStats = {
    users,
    verified,
    disabled,
    google,
    newUsers7,
    newUsers30,
    activeUsers7,
    storageBytes: Number(bytesAgg.data().bytes) || 0,
    files: Number(filesAgg.data().files) || 0,
    sharesActive: noExpiry.data().count + notExpired.data().count,
    at: now,
  };

  const batch = db.batch();
  batch.set(db.doc("stats/current"), stats);
  // Today's snapshot (for growth charts) and the last 30 days of sign-ups
  batch.set(db.doc(`statsDaily/${istDay()}`), { day: istDay(), users, storageBytes: stats.storageBytes, files: stats.files }, { merge: true });
  for (let i = 0; i < 30; i++) {
    const day = istDay(new Date(now - i * DAY));
    batch.set(db.doc(`statsDaily/${day}`), { day, signups: signupsByDay.get(day) ?? 0 }, { merge: true });
  }
  await batch.commit();
  return stats;
}

/** Keeps the admin overview fresh without anyone waiting for it. */
export const computeStatsHourly = onSchedule({ schedule: "every 60 minutes", timeZone: "Asia/Kolkata", memory: "512MiB" }, async () => {
  const s = await computeStats();
  logger.info("Stats updated", { users: s.users, storageBytes: s.storageBytes });
});
