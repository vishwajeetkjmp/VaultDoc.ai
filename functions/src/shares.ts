import "./setup";
import { createHash, randomBytes } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { logger } from "firebase-functions/v2";
import { CallableRequest, HttpsError, onCall } from "firebase-functions/v2/https";
import { APP_URL, RESEND_API_KEY, sendMail, shareInviteMail } from "./email";
import { bumpDaily, istDay } from "./stats";

/**
 * Sharing My Space files and folders.
 *
 *   shares/{linkId}   one per shared item; linkId is 22 random characters and is the link itself
 *
 * Every change goes through these functions (the app can only read its own shares), so ownership,
 * invite limits and emails are enforced here. Recipients never touch the owner's data directly:
 * they get the file list from openShare and a 10-minute signed download URL from shareFileUrl,
 * so files download straight from Cloud Storage. The Secure Vault can't be shared (it's encrypted
 * with keys only the owner's devices hold).
 */

const db = () => getFirestore();
const LINK_ID = /^[A-Za-z0-9_-]{22}$/;
const ITEM_ID = /^[A-Za-z0-9_-]{1,128}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_INVITEES = 20;
const MAX_INVITE_EMAILS_PER_DAY = 100;
const MAX_EXPIRY_MS = 366 * 86_400_000;
const MAX_FOLDER_ITEMS = 2000;
const URL_TTL_MS = 10 * 60_000;
// Shown in the browser instead of downloaded; anything else always downloads
const INLINE_TYPES = /^(application\/pdf|image\/(png|jpeg|webp|gif)|text\/plain)$/;

type Mode = "link" | "invite";

type Share = {
  ownerUid: string;
  ownerName: string;
  ownerEmail: string;
  itemId: string;
  itemKind: "file" | "folder";
  itemName: string;
  mode: Mode;
  invitees: string[];
  expiresAt: Timestamp | null;
  views: number;
  downloads: number;
};

/** The caller, who must be logged in with a verified email. */
async function verifiedCaller(request: CallableRequest) {
  const token = request.auth?.token;
  if (!request.auth || !token) throw new HttpsError("unauthenticated", "Please log in first.");
  if (!token.email_verified || !token.email) throw new HttpsError("failed-precondition", "Please verify your email first.");
  const email = token.email.toLowerCase();
  const name = (token.name as string | undefined) || (await getAuth().getUser(request.auth.uid)).displayName || email.split("@")[0];
  return { uid: request.auth.uid, email, name };
}

const shareRef = (linkId: string) => db().doc(`shares/${linkId}`);
const itemRef = (uid: string, itemId: string) => db().doc(`users/${uid}/items/${itemId}`);

function linkIdFrom(data: unknown): string {
  const linkId = (data as { linkId?: unknown })?.linkId;
  if (typeof linkId !== "string" || !LINK_ID.test(linkId)) throw new HttpsError("not-found", "This link isn't valid.");
  return linkId;
}

/**
 * Whether the caller may open this share. Errors carry a `reason` the recipient page turns into
 * a friendly screen: gone, expired, login, verify, wrong-account.
 */
async function openableShare(linkId: string, request: CallableRequest): Promise<{ share: Share; isOwner: boolean }> {
  const snap = await shareRef(linkId).get();
  if (!snap.exists) throw new HttpsError("not-found", "This link isn't active anymore.", { reason: "gone" });
  const share = snap.data() as Share;
  const isOwner = request.auth?.uid === share.ownerUid;
  if (isOwner) return { share, isOwner };
  if (share.expiresAt && share.expiresAt.toMillis() < Date.now()) {
    throw new HttpsError("failed-precondition", "This link has expired.", { reason: "expired" });
  }
  if (share.mode === "invite") {
    const token = request.auth?.token;
    if (!token) throw new HttpsError("unauthenticated", "Log in to open this.", { reason: "login" });
    if (!token.email_verified) throw new HttpsError("permission-denied", "Verify your email to open this.", { reason: "verify" });
    const email = (token.email ?? "").toLowerCase();
    if (!share.invitees.includes(email)) {
      throw new HttpsError("permission-denied", "This was shared with a different email.", { reason: "wrong-account", email });
    }
  }
  return { share, isOwner };
}

/** Counts invite emails per user per day (stored next to the tool limits, which expire automatically). */
async function reserveInviteEmails(uid: string, count: number) {
  if (!count) return;
  const key = createHash("sha256").update(`vaultdoc-mail:${uid}`).digest("hex").slice(0, 32);
  const ref = db().doc(`toolRateLimits/mail_${key}_${istDay()}`);
  await db().runTransaction(async (tx) => {
    const used = Number((await tx.get(ref)).get("count")) || 0;
    if (used + count > MAX_INVITE_EMAILS_PER_DAY) {
      throw new HttpsError("resource-exhausted", `You can send up to ${MAX_INVITE_EMAILS_PER_DAY} invitations a day. Copy the link instead, or try tomorrow.`);
    }
    tx.set(ref, { count: FieldValue.increment(count), expireAt: Timestamp.fromMillis(Date.now() + 2 * 86_400_000), uid, kind: "mail" }, { merge: true });
  });
}

/**
 * Creates or updates the share for one item (each item has at most one share, like Drive).
 * New invitees get an email. Returns the link.
 */
export const saveShare = onCall({ secrets: [RESEND_API_KEY] }, async (request) => {
  const me = await verifiedCaller(request);
  const data = (request.data ?? {}) as { itemId?: unknown; mode?: unknown; invitees?: unknown; expiresAt?: unknown; message?: unknown };

  if (typeof data.itemId !== "string" || !ITEM_ID.test(data.itemId)) throw new HttpsError("invalid-argument", "Unknown item.");
  if (data.mode !== "link" && data.mode !== "invite") throw new HttpsError("invalid-argument", "Choose who can open the link.");
  const mode = data.mode as Mode;

  const rawInvitees = Array.isArray(data.invitees) ? data.invitees : [];
  const invitees = [...new Set(rawInvitees.map((e) => String(e).trim().toLowerCase()).filter(Boolean))].filter((e) => e !== me.email);
  const bad = invitees.find((e) => !EMAIL.test(e) || e.length > 254);
  if (bad) throw new HttpsError("invalid-argument", `“${bad}” isn't a valid email address.`);
  if (invitees.length > MAX_INVITEES) throw new HttpsError("invalid-argument", `You can invite up to ${MAX_INVITEES} people per item.`);

  let expiresAt: Timestamp | null = null;
  if (data.expiresAt !== null && data.expiresAt !== undefined) {
    const ms = Number(data.expiresAt);
    if (!Number.isFinite(ms) || ms <= Date.now() || ms > Date.now() + MAX_EXPIRY_MS) {
      throw new HttpsError("invalid-argument", "Pick an expiry date within the next year.");
    }
    expiresAt = Timestamp.fromMillis(ms);
  }
  const message = typeof data.message === "string" ? data.message.trim().slice(0, 500) : "";

  const item = await itemRef(me.uid, data.itemId).get();
  if (!item.exists || item.get("status") !== "ready") throw new HttpsError("not-found", "This item no longer exists.");

  const existing = (await db().collection("shares").where("ownerUid", "==", me.uid).where("itemId", "==", data.itemId).limit(1).get()).docs[0];
  const linkId = existing?.id ?? randomBytes(16).toString("base64url");
  const before: string[] = existing?.get("invitees") ?? [];
  const newInvitees = invitees.filter((e) => !before.includes(e));
  await reserveInviteEmails(me.uid, newInvitees.length);

  const itemKind = item.get("kind") as "file" | "folder";
  const itemName = item.get("name") as string;
  await shareRef(linkId).set(
    {
      ownerUid: me.uid,
      ownerName: me.name,
      ownerEmail: me.email,
      itemId: data.itemId,
      itemKind,
      itemName,
      mode,
      invitees,
      expiresAt,
      updatedAt: FieldValue.serverTimestamp(),
      ...(existing ? {} : { views: 0, downloads: 0, lastOpenedAt: null, createdAt: FieldValue.serverTimestamp() }),
    },
    { merge: true },
  );

  const url = `${APP_URL.value().replace(/\/$/, "")}/s/${linkId}`;
  const results = await Promise.allSettled(
    newInvitees.map((to) =>
      sendMail(
        shareInviteMail({
          to,
          fromName: me.name,
          fromEmail: me.email,
          itemName,
          isFolder: itemKind === "folder",
          link: url,
          message,
          expiresAt: expiresAt?.toDate() ?? null,
          requiresLogin: mode === "invite",
        }),
      ),
    ),
  );
  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length) logger.error("Some invite emails failed", { count: failed.length, reason: String((failed[0] as PromiseRejectedResult).reason) });

  await bumpDaily({ ...(existing ? {} : { sharesCreated: 1 }), inviteEmails: newInvitees.length - failed.length });
  return { linkId, url, emailed: newInvitees.length - failed.length, emailFailed: failed.length };
});

/** Stops sharing: the link stops working immediately for everyone. */
export const revokeShare = onCall(async (request) => {
  const me = await verifiedCaller(request);
  const linkId = linkIdFrom(request.data);
  const snap = await shareRef(linkId).get();
  if (snap.exists && snap.get("ownerUid") === me.uid) await snap.ref.delete();
  return { ok: true };
});

/** "Shared with me": active shares that invited the caller's email. */
export const sharedWithMe = onCall(async (request) => {
  const me = await verifiedCaller(request);
  const snaps = await db().collection("shares").where("invitees", "array-contains", me.email).limit(200).get();
  const now = Date.now();
  const active = snaps.docs.filter((d) => {
    const exp = d.get("expiresAt") as Timestamp | null;
    return !exp || exp.toMillis() > now;
  });
  // Current names (the owner may have renamed the item since sharing)
  const items = active.length ? await db().getAll(...active.map((d) => itemRef(d.get("ownerUid"), d.get("itemId")))) : [];
  return {
    shares: active
      .map((d, i) => ({
        linkId: d.id,
        itemName: (items[i]?.get("name") as string) ?? d.get("itemName"),
        itemKind: d.get("itemKind"),
        exists: !!items[i]?.exists,
        ownerName: d.get("ownerName"),
        ownerEmail: d.get("ownerEmail"),
        sharedAt: (d.get("createdAt") as Timestamp | null)?.toMillis() ?? null,
        expiresAt: (d.get("expiresAt") as Timestamp | null)?.toMillis() ?? null,
      }))
      .filter((s) => s.exists)
      .sort((a, b) => (b.sharedAt ?? 0) - (a.sharedAt ?? 0)),
  };
});

type PublicItem = { id: string; kind: "file" | "folder"; name: string; parentId: string; size: number; contentType: string | null };
const publicItem = (d: FirebaseFirestore.DocumentSnapshot): PublicItem => ({
  id: d.id,
  kind: d.get("kind"),
  name: d.get("name"),
  parentId: d.get("parentId"),
  size: Number(d.get("size")) || 0,
  contentType: d.get("contentType") ?? null,
});

/** Recipient page: what was shared (and, for a folder, everything inside it). Counts a view. */
export const openShare = onCall(async (request) => {
  const linkId = linkIdFrom(request.data);
  const { share, isOwner } = await openableShare(linkId, request);

  const root = await itemRef(share.ownerUid, share.itemId).get();
  if (!root.exists || root.get("status") !== "ready") throw new HttpsError("not-found", "This item was deleted by its owner.", { reason: "deleted" });

  let items: PublicItem[] = [];
  let truncated = false;
  if (root.get("kind") === "folder") {
    const inside = await db()
      .collection(`users/${share.ownerUid}/items`)
      .where("ancestorIds", "array-contains", share.itemId)
      .limit(MAX_FOLDER_ITEMS + 1)
      .get();
    truncated = inside.size > MAX_FOLDER_ITEMS;
    items = inside.docs
      .slice(0, MAX_FOLDER_ITEMS)
      .filter((d) => d.get("status") === "ready")
      .map(publicItem);
  }

  if (!isOwner) {
    await shareRef(linkId).update({ views: FieldValue.increment(1), lastOpenedAt: FieldValue.serverTimestamp() });
    await bumpDaily({ shareOpens: 1 });
  }

  return {
    mode: share.mode,
    ownerName: share.ownerName,
    expiresAt: share.expiresAt?.toMillis() ?? null,
    isOwner,
    root: publicItem(root),
    items,
    truncated,
  };
});

/**
 * A short-lived URL for one file in a share, straight from Cloud Storage (no function bandwidth).
 * `download: false` opens PDFs and images in the browser instead. `count` adds to the download total
 * (a folder ZIP counts once, not once per file).
 */
export const shareFileUrl = onCall(async (request) => {
  const linkId = linkIdFrom(request.data);
  const data = request.data as { itemId?: unknown; download?: unknown; count?: unknown };
  if (typeof data.itemId !== "string" || !ITEM_ID.test(data.itemId)) throw new HttpsError("invalid-argument", "Unknown file.");
  const { share, isOwner } = await openableShare(linkId, request);

  const item = await itemRef(share.ownerUid, data.itemId).get();
  const inShare = item.id === share.itemId || ((item.get("ancestorIds") as string[] | undefined) ?? []).includes(share.itemId);
  if (!item.exists || !inShare || item.get("kind") !== "file" || item.get("status") !== "ready") {
    throw new HttpsError("not-found", "This file isn't available.");
  }

  const name = String(item.get("name"));
  const contentType = (item.get("contentType") as string | null) ?? "application/octet-stream";
  const inline = data.download === false && INLINE_TYPES.test(contentType);
  const file = getStorage().bucket().file(String(item.get("storagePath")));

  if (data.count === true && !isOwner) {
    await shareRef(linkId).update({ downloads: FieldValue.increment(1), lastOpenedAt: FieldValue.serverTimestamp() });
    await bumpDaily({ shareDownloads: 1 });
  }

  // The Storage emulator can't sign URLs, so on the emulators the bytes come back directly
  if (process.env.FUNCTIONS_EMULATOR === "true") {
    const [bytes] = await file.download();
    return { data: bytes.toString("base64"), contentType, name };
  }

  // ASCII fallback name for old browsers, the real (UTF-8) name for everyone else
  const ascii = name.replace(/[^\x20-\x7e]|["\\]/g, "_");
  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + URL_TTL_MS,
    responseDisposition: `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    responseType: contentType,
  });
  return { url, name };
});

/** Stops every share of an item (it was deleted). */
export async function deleteSharesOfItem(uid: string, itemId: string) {
  const snaps = await db().collection("shares").where("ownerUid", "==", uid).where("itemId", "==", itemId).get();
  await Promise.all(snaps.docs.map((d) => d.ref.delete()));
}

/** Removes all of a user's shares (account deleted or disabled by an admin). Returns how many. */
export async function deleteSharesOfUser(uid: string): Promise<number> {
  const snaps = await db().collection("shares").where("ownerUid", "==", uid).get();
  for (let i = 0; i < snaps.docs.length; i += 400) {
    const batch = db().batch();
    snaps.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  return snaps.size;
}
