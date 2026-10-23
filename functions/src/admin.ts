import "./setup";
import { getAuth, UserRecord } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { logger } from "firebase-functions/v2";
import { defineString } from "firebase-functions/params";
import { CallableRequest, HttpsError, onCall } from "firebase-functions/v2/https";
import { wipeAccount } from "./accounts";
import { convertUsage, converterHealth, RATE_LIMIT_PER_HOUR, resetConvertLimit } from "./convert";
import { APP_URL, RESEND_API_KEY, sendMail } from "./email";
import { deleteSharesOfUser } from "./shares";
import { computeStats, CurrentStats, istDay } from "./stats";

/**
 * The admin panel's single API. One function (one warm instance) handles every admin action, so each
 * one passes the same checks:
 *   - the caller has an admin role (Firebase custom claim `role`: owner > support > viewer)
 *   - the caller logged in with Google (their Google 2-step verification protects the account)
 *   - changes need a written reason and are recorded in adminAudit (append-only; no one can edit it)
 * Admins see account details and numbers, never file names or contents. The Secure Vault is
 * end-to-end encrypted, so it can't be read even here.
 *
 *   adminRoles/{uid}   who has which role (mirror of the custom claims, for the Team page)
 *   adminAudit/{id}    every admin change
 *   stats/current      totals for the Overview (see stats.ts)
 */

// The one email allowed to claim the first Owner role (set in functions/.env.<project>)
const OWNER_EMAIL = defineString("OWNER_EMAIL", { default: "" });

type Role = "owner" | "support" | "viewer";
const RANK: Record<Role, number> = { viewer: 1, support: 2, owner: 3 };
const ROLES = Object.keys(RANK) as Role[];
const isRole = (r: unknown): r is Role => typeof r === "string" && r in RANK;

type Admin = { uid: string; email: string; role: Role };
const db = () => getFirestore();

function caller(request: CallableRequest): { uid: string; email: string; role?: Role; google: boolean } {
  const token = request.auth?.token;
  if (!request.auth || !token?.email) throw new HttpsError("unauthenticated", "Please log in.");
  // Google sign-in required for admins; password accounts are allowed only on the emulators (tests)
  const google = token.firebase?.sign_in_provider === "google.com" || process.env.FUNCTIONS_EMULATOR === "true";
  return { uid: request.auth.uid, email: token.email.toLowerCase(), role: isRole(token.role) ? token.role : undefined, google };
}

function requireRole(request: CallableRequest, min: Role): Admin {
  const c = caller(request);
  if (!c.role || RANK[c.role] < RANK[min]) throw new HttpsError("permission-denied", "You don't have access to this.");
  if (!c.google) throw new HttpsError("permission-denied", "Admins must log in with Google.");
  return { uid: c.uid, email: c.email, role: c.role };
}

function reasonOf(data: Record<string, unknown>): string {
  const reason = typeof data.reason === "string" ? data.reason.trim() : "";
  if (reason.length < 3) throw new HttpsError("invalid-argument", "Please give a reason (it's saved in the audit log).");
  return reason.slice(0, 500);
}

async function audit(actor: Admin, action: string, reason: string, target?: { uid?: string; email?: string; id?: string }, details?: Record<string, unknown>) {
  await db().collection("adminAudit").add({
    at: FieldValue.serverTimestamp(),
    actorUid: actor.uid,
    actorEmail: actor.email,
    actorRole: actor.role,
    action,
    reason,
    targetUid: target?.uid ?? null,
    targetEmail: target?.email ?? null,
    targetId: target?.id ?? null,
    details: details ?? null,
  });
}

const ms = (t: unknown) => (t instanceof Timestamp ? t.toMillis() : null);
const parseTime = (s?: string) => (s ? Date.parse(s) || null : null);

/** Account summary for tables (no file names or contents). */
async function userRows(records: UserRecord[]) {
  if (!records.length) return [];
  const usage = await db().getAll(...records.map((u) => db().doc(`users/${u.uid}`)));
  return records.map((u, i) => ({
    uid: u.uid,
    email: u.email ?? null,
    name: u.displayName ?? null,
    photo: u.photoURL ?? null,
    providers: u.providerData.map((p) => p.providerId),
    verified: u.emailVerified,
    disabled: u.disabled,
    role: isRole(u.customClaims?.role) ? u.customClaims!.role : null,
    createdAt: parseTime(u.metadata.creationTime),
    lastActiveAt: parseTime(u.metadata.lastRefreshTime ?? u.metadata.lastSignInTime),
    usedBytes: Number(usage[i].get("usedBytes")) || 0,
    fileCount: Number(usage[i].get("fileCount")) || 0,
    quotaBytes: Number(usage[i].get("quotaBytes")) || null,
  }));
}

async function targetUser(data: Record<string, unknown>, actor: Admin): Promise<UserRecord> {
  if (typeof data.uid !== "string" || !data.uid) throw new HttpsError("invalid-argument", "Which user?");
  const user = await getAuth().getUser(data.uid).catch(() => null);
  if (!user) throw new HttpsError("not-found", "That user doesn't exist.");
  if (user.uid === actor.uid) throw new HttpsError("failed-precondition", "You can't do this to your own account.");
  const role = user.customClaims?.role;
  if (isRole(role) && RANK[role] >= RANK[actor.role]) throw new HttpsError("permission-denied", "You can't change an admin with the same or a higher role.");
  return user;
}

type Handler = (request: CallableRequest, data: Record<string, unknown>) => Promise<unknown>;

const actions: Record<string, Handler> = {
  /** Role of the caller, and whether they may claim the first Owner role. */
  async whoami(request) {
    const c = caller(request);
    const ownerEmail = OWNER_EMAIL.value().trim().toLowerCase();
    let canClaimOwner = false;
    if (!c.role && ownerEmail && c.email === ownerEmail) {
      canClaimOwner = (await db().collection("adminRoles").where("role", "==", "owner").limit(1).get()).empty;
    }
    return { role: c.role ?? null, email: c.email, google: c.google, canClaimOwner };
  },

  /** One-time setup: the configured owner email becomes Owner, only while there is none. */
  async claimOwner(request) {
    const c = caller(request);
    const ownerEmail = OWNER_EMAIL.value().trim().toLowerCase();
    if (!ownerEmail || c.email !== ownerEmail) throw new HttpsError("permission-denied", "This account can't claim the owner role.");
    if (!c.google) throw new HttpsError("permission-denied", "Log in with Google to become an admin.");
    if (!request.auth?.token.email_verified) throw new HttpsError("permission-denied", "Verify your email first.");
    const ref = db().doc(`adminRoles/${c.uid}`);
    await db().runTransaction(async (tx) => {
      const owners = await tx.get(db().collection("adminRoles").where("role", "==", "owner").limit(1));
      if (!owners.empty) throw new HttpsError("already-exists", "There is already an owner.");
      tx.set(ref, { email: c.email, role: "owner", addedBy: "setup", at: FieldValue.serverTimestamp() });
    });
    await getAuth().setCustomUserClaims(c.uid, { role: "owner" });
    await audit({ uid: c.uid, email: c.email, role: "owner" }, "claimOwner", "First owner set up", { uid: c.uid, email: c.email });
    return { role: "owner" };
  },

  /** Overview: totals (refreshed hourly, or now if older than 2 hours) and the last 30 days. */
  async overview(request, data) {
    requireRole(request, "viewer");
    const snap = await db().doc("stats/current").get();
    let current = snap.data() as CurrentStats | undefined;
    if (!current || data.refresh === true || Date.now() - current.at > 2 * 3_600_000) current = await computeStats();
    const since = istDay(new Date(Date.now() - 29 * 86_400_000));
    const days = await db().collection("statsDaily").where("day", ">=", since).orderBy("day").get();
    return { current, days: days.docs.map((d) => d.data()) };
  },

  /** Users table: one page of accounts (newest login system order), or an exact email / id lookup. */
  async listUsers(request, data) {
    requireRole(request, "support");
    const q = typeof data.query === "string" ? data.query.trim() : "";
    if (q) {
      const found = await (q.includes("@") ? getAuth().getUserByEmail(q.toLowerCase()) : getAuth().getUser(q)).catch(() => null);
      return { users: await userRows(found ? [found] : []), nextPageToken: null };
    }
    const page = await getAuth().listUsers(Math.min(Number(data.pageSize) || 100, 500), typeof data.pageToken === "string" ? data.pageToken : undefined);
    return { users: await userRows(page.users), nextPageToken: page.pageToken ?? null };
  },

  /** Detail panel for one user. */
  async getUser(request, data) {
    requireRole(request, "support");
    if (typeof data.uid !== "string") throw new HttpsError("invalid-argument", "Which user?");
    const user = await getAuth().getUser(data.uid).catch(() => null);
    if (!user) throw new HttpsError("not-found", "That user doesn't exist.");
    const [[row], shares, vault, conversions, limits] = await Promise.all([
      userRows([user]),
      db().collection("shares").where("ownerUid", "==", user.uid).count().get(),
      db().doc(`users/${user.uid}/vault/meta`).get(),
      convertUsage(user.uid),
      db().doc("config/limits").get(),
    ]);
    return {
      user: row,
      sharesCount: shares.data().count,
      vaultSetUp: vault.exists,
      conversionsThisHour: conversions,
      conversionLimit: RATE_LIMIT_PER_HOUR,
      defaultQuotaBytes: Number(limits.get("quotaBytes")) || 1024 ** 3,
    };
  },

  /** Account actions. Support: resend verification, disable/enable, quota, limits, shares. Owner: delete. */
  async userAction(request, data) {
    // `action` is taken by the dispatcher ("userAction"), so the account action is `op`
    const action = String(data.op ?? "");
    const actor = requireRole(request, action === "delete" ? "owner" : "support");
    const reason = reasonOf(data);
    const user = await targetUser(data, actor);
    const target = { uid: user.uid, email: user.email ?? undefined };
    let details: Record<string, unknown> | undefined;

    switch (action) {
      case "disable":
        await getAuth().updateUser(user.uid, { disabled: true });
        await getAuth().revokeRefreshTokens(user.uid); // signs them out everywhere
        break;
      case "enable":
        await getAuth().updateUser(user.uid, { disabled: false });
        break;
      case "resendVerification": {
        if (!user.email) throw new HttpsError("failed-precondition", "This account has no email.");
        if (user.emailVerified) throw new HttpsError("failed-precondition", "This email is already verified.");
        const link = await getAuth().generateEmailVerificationLink(user.email, { url: `${APP_URL.value().replace(/\/$/, "")}/dashboard` });
        await sendMail({
          to: user.email,
          subject: "Verify your email for VaultDocAI",
          text: `Verify your email to use VaultDocAI: ${link}`,
          html: `<p style="font-family:Arial,sans-serif;font-size:15px">Verify your email to start using VaultDocAI.</p><p><a href="${link}" style="font-family:Arial,sans-serif;background:#141413;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Verify email</a></p>`,
        });
        break;
      }
      case "setQuota": {
        const gb = data.quotaGb === null ? null : Number(data.quotaGb);
        if (gb !== null && (!Number.isFinite(gb) || gb < 0.1 || gb > 1000)) throw new HttpsError("invalid-argument", "Quota must be between 0.1 and 1000 GB.");
        await db().doc(`users/${user.uid}`).set({ quotaBytes: gb === null ? FieldValue.delete() : Math.round(gb * 1024 ** 3) }, { merge: true });
        details = { quotaGb: gb };
        break;
      }
      case "resetToolLimit":
        await resetConvertLimit(user.uid);
        break;
      case "stopShares":
        details = { stopped: await deleteSharesOfUser(user.uid) };
        break;
      case "delete":
        await wipeAccount(user.uid);
        break;
      default:
        throw new HttpsError("invalid-argument", "Unknown action.");
    }
    await audit(actor, `user.${action}`, reason, target, details);
    logger.info("Admin action", { actor: actor.email, action, target: user.uid });
    return { ok: true, ...(details ?? {}) };
  },

  /** Shares table without file names (privacy). Newest first, 50 per page. */
  async listShares(request, data) {
    requireRole(request, "support");
    let q = db().collection("shares").orderBy("createdAt", "desc").limit(50);
    if (typeof data.after === "number") q = q.startAfter(Timestamp.fromMillis(data.after));
    const snap = await q.get();
    return {
      shares: snap.docs.map((d) => ({
        linkId: d.id,
        ownerUid: d.get("ownerUid"),
        ownerEmail: d.get("ownerEmail"),
        itemKind: d.get("itemKind"),
        mode: d.get("mode"),
        inviteeCount: (d.get("invitees") ?? []).length,
        expiresAt: ms(d.get("expiresAt")),
        views: d.get("views") ?? 0,
        downloads: d.get("downloads") ?? 0,
        lastOpenedAt: ms(d.get("lastOpenedAt")),
        createdAt: ms(d.get("createdAt")),
      })),
    };
  },

  /** Stop one share (abuse report). */
  async stopShare(request, data) {
    const actor = requireRole(request, "support");
    const reason = reasonOf(data);
    if (typeof data.linkId !== "string") throw new HttpsError("invalid-argument", "Which share?");
    const snap = await db().doc(`shares/${data.linkId}`).get();
    if (!snap.exists) throw new HttpsError("not-found", "That share no longer exists.");
    await snap.ref.delete();
    await audit(actor, "share.stop", reason, { uid: snap.get("ownerUid"), email: snap.get("ownerEmail"), id: data.linkId });
    return { ok: true };
  },

  /** Abuse signals: biggest storage users, people hitting limits now, most-opened links. */
  async abuse(request) {
    requireRole(request, "support");
    const [top, limited, opened] = await Promise.all([
      db().collection("users").orderBy("usedBytes", "desc").limit(15).get(),
      db().collection("toolRateLimits").where("count", ">=", RATE_LIMIT_PER_HOUR).limit(50).get(),
      db().collection("shares").orderBy("views", "desc").limit(10).get(),
    ]);
    const uids = [...new Set([...top.docs.map((d) => d.id), ...limited.docs.map((d) => d.get("uid")).filter(Boolean)])];
    const accounts = uids.length ? (await getAuth().getUsers(uids.map((uid) => ({ uid })))).users : [];
    const emailOf = new Map(accounts.map((u) => [u.uid, u.email ?? u.uid]));
    return {
      topStorage: top.docs.map((d) => ({ uid: d.id, email: emailOf.get(d.id) ?? d.id, usedBytes: d.get("usedBytes") ?? 0, fileCount: d.get("fileCount") ?? 0 })),
      limitHits: limited.docs
        .filter((d) => ((d.get("expireAt") as Timestamp | undefined)?.toMillis() ?? 0) > Date.now())
        .map((d) => ({ uid: d.get("uid") ?? null, email: emailOf.get(d.get("uid")) ?? "unknown (older record)", kind: d.get("kind") ?? "convert", count: d.get("count") })),
      mostOpened: opened.docs.map((d) => ({ linkId: d.id, ownerEmail: d.get("ownerEmail"), mode: d.get("mode"), views: d.get("views") ?? 0, downloads: d.get("downloads") ?? 0 })),
    };
  },

  /** Audit log, newest first, 100 per page. */
  async audit(request, data) {
    requireRole(request, "support");
    let q = db().collection("adminAudit").orderBy("at", "desc").limit(100);
    if (typeof data.after === "number") q = q.startAfter(Timestamp.fromMillis(data.after));
    const snap = await q.get();
    return {
      entries: snap.docs.map((d) => ({ id: d.id, ...d.data(), at: ms(d.get("at")) })),
    };
  },

  /** Team: everyone with an admin role. */
  async team(request) {
    requireRole(request, "owner");
    const snap = await db().collection("adminRoles").get();
    return { members: snap.docs.map((d) => ({ uid: d.id, email: d.get("email"), role: d.get("role"), addedBy: d.get("addedBy"), at: ms(d.get("at")) })) };
  },

  /** Give someone a role (they must have logged in once), change it, or remove it (role: null). */
  async setRole(request, data) {
    const actor = requireRole(request, "owner");
    const reason = reasonOf(data);
    const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
    const role = data.role === null ? null : isRole(data.role) ? data.role : undefined;
    if (role === undefined) throw new HttpsError("invalid-argument", `Role must be one of: ${ROLES.join(", ")}.`);
    const user = await getAuth().getUserByEmail(email).catch(() => null);
    if (!user) throw new HttpsError("not-found", "No VaultDoc account uses this email. Ask them to log in once with Google first.");
    if (user.uid === actor.uid) throw new HttpsError("failed-precondition", "You can't change your own role.");
    await getAuth().setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), role: role ?? null });
    await getAuth().revokeRefreshTokens(user.uid); // the new role applies at their next login
    const ref = db().doc(`adminRoles/${user.uid}`);
    if (role) await ref.set({ email, role, addedBy: actor.email, at: FieldValue.serverTimestamp() });
    else await ref.delete();
    await audit(actor, role ? "team.setRole" : "team.removeRole", reason, { uid: user.uid, email }, { role });
    return { ok: true };
  },

  /** System page: live checks with response times. */
  async health(request) {
    requireRole(request, "viewer");
    const time = async (fn: () => Promise<unknown>) => {
      const started = Date.now();
      try {
        await fn();
        return { ok: true, ms: Date.now() - started };
      } catch (e) {
        return { ok: false, ms: Date.now() - started, detail: e instanceof Error ? e.message : String(e) };
      }
    };
    const [firestore, storage, auth, converter, stats] = await Promise.all([
      time(() => db().doc("config/limits").get()),
      time(() => getStorage().bucket().getFiles({ maxResults: 1, autoPaginate: false })),
      time(() => getAuth().listUsers(1)),
      converterHealth(),
      db().doc("stats/current").get(),
    ]);
    let email: { ok: boolean; detail?: string };
    try {
      const key = RESEND_API_KEY.value();
      email = { ok: !!key && key !== "emulator-not-used", detail: key && key !== "emulator-not-used" ? undefined : "No Resend key on this environment" };
    } catch {
      email = { ok: false, detail: "No Resend key set" };
    }
    return {
      checks: { firestore, storage, auth, converter, email },
      statsUpdatedAt: (stats.get("at") as number | undefined) ?? null,
      project: process.env.GCLOUD_PROJECT ?? null,
      region: "asia-south2",
    };
  },
};

export const adminApi = onCall({ secrets: [RESEND_API_KEY], memory: "512MiB", timeoutSeconds: 120 }, async (request) => {
  const data = (request.data ?? {}) as Record<string, unknown>;
  const handler = actions[String(data.action ?? "")];
  if (!handler) throw new HttpsError("invalid-argument", "Unknown admin action.");
  return handler(request, data);
});
