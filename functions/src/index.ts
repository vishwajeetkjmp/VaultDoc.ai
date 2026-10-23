import "./setup";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { logger } from "firebase-functions/v2";
import { onObjectFinalized } from "firebase-functions/v2/storage";
import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { deletedUserRef, wipeAccount } from "./accounts";
import { deleteSharesOfItem } from "./shares";


const db = getFirestore();

// My Files: users/{uid}/files/{id} ↔ items/{id}. Secure Vault (encrypted): users/{uid}/vault/{id} ↔ vaultItems/{id}
const FILE_PATH = /^users\/([^/]+)\/(files|vault)\/([^/]+)$/;
// Encrypted vault files are slightly larger than the original (IV + tag)
const VAULT_OVERHEAD_BYTES = 1024;


// Defaults, overridable with the Firestore document config/limits (keep in sync with apps/web/lib/files/limits.ts)
const DEFAULT_MAX_FILE_BYTES = 20 * 1024 * 1024;
const DEFAULT_QUOTA_BYTES = 1024 * 1024 * 1024;

/**
 * A file finished uploading: check it against the limits, then mark its
 * record ready with the real size and add it to the owner's storage total.
 * The app can't write usage itself, so this is the only place the total goes
 * up, and the quota is enforced here rather than in the Storage rules.
 */
export const onFileUploaded = onObjectFinalized(async (event) => {
  const match = FILE_PATH.exec(event.data.name);
  if (!match) return;
  const [, uid, area, itemId] = match;
  const isVault = area === "vault";
  const size = Number(event.data.size);

  const itemRef = db.doc(`users/${uid}/${isVault ? "vaultItems" : "items"}/${itemId}`);
  const userRef = db.doc(`users/${uid}`);
  const configRef = db.doc("config/limits");

  const orphan = await db.runTransaction(async (tx) => {
    const [item, user, config, tombstone] = await Promise.all([
      tx.get(itemRef),
      tx.get(userRef),
      tx.get(configRef),
      tx.get(deletedUserRef(uid)),
    ]);
    if (!item.exists || tombstone.exists) return true; // record deleted (upload cancelled, or account deleted)
    if (item.get("status") === "ready") return false; // already counted (event retried)

    const maxFileBytes =
      (Number(config.get("maxFileBytes")) || DEFAULT_MAX_FILE_BYTES) + (isVault ? VAULT_OVERHEAD_BYTES : 0);
    const quotaBytes = Number(user.get("quotaBytes")) || Number(config.get("quotaBytes")) || DEFAULT_QUOTA_BYTES;
    const usedBytes = Number(user.get("usedBytes")) || 0;
    if (size > maxFileBytes || usedBytes + size > quotaBytes) {
      logger.warn("Upload over limit, removing", { uid, itemId, size, usedBytes, quotaBytes, maxFileBytes });
      tx.delete(itemRef); // the deletion trigger removes the stored file
      return false;
    }

    tx.update(itemRef, {
      status: "ready",
      size,
      // Vault records keep their (encrypted) type; the stored type is always octet-stream
      ...(isVault ? {} : { contentType: event.data.contentType ?? null }),
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.set(
      userRef,
      { usedBytes: FieldValue.increment(size), fileCount: FieldValue.increment(1) },
      { merge: true },
    );
    return false;
  });

  if (orphan) {
    logger.info("Deleting file with no record", { path: event.data.name });
    await getStorage().bucket(event.data.bucket).file(event.data.name).delete({ ignoreNotFound: true });
  }
});

/**
 * A file record was deleted: remove the stored file and subtract it from the
 * owner's total. Deletion events can be delivered more than once, so each
 * event id is recorded to avoid subtracting twice.
 */
async function cleanUpDeletedFile(uid: string, eventId: string, data: FirebaseFirestore.DocumentData | undefined) {
  if (!data || data.kind !== "file") return;

  if (typeof data.storagePath === "string") {
    await getStorage().bucket().file(data.storagePath).delete({ ignoreNotFound: true });
  }

  if (data.status !== "ready") return; // never counted
  if ((await deletedUserRef(uid).get()).exists) return; // whole account is being deleted; nothing to update
  const size = Number(data.size) || 0;
  const userRef = db.doc(`users/${uid}`);
  const eventRef = db.doc(`users/${uid}/_events/${eventId}`);

  await db.runTransaction(async (tx) => {
    if ((await tx.get(eventRef)).exists) return;
    tx.create(eventRef, { at: FieldValue.serverTimestamp() });
    tx.set(
      userRef,
      { usedBytes: FieldValue.increment(-size), fileCount: FieldValue.increment(-1) },
      { merge: true },
    );
  });
}

export const onItemDeleted = onDocumentDeleted("users/{uid}/items/{itemId}", async (event) => {
  // A deleted item can't stay shared (folders delete their contents one by one, so each is covered)
  await deleteSharesOfItem(event.params.uid, event.params.itemId);
  await cleanUpDeletedFile(event.params.uid, event.id, event.data?.data());
});

export const onVaultItemDeleted = onDocumentDeleted("users/{uid}/vaultItems/{itemId}", (event) =>
  cleanUpDeletedFile(event.params.uid, event.id, event.data?.data()),
);

/**
 * Deletes the caller's account and everything in it: My Files and Secure Vault
 * files, their records, the usage record, and the sign-in account itself.
 * Requires a sign-in within the last 5 minutes, so an unattended session
 * can't be used to wipe someone's account.
 */
export const deleteAccount = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  const signedInAt = Number(request.auth?.token.auth_time) || 0;
  if (Date.now() / 1000 - signedInAt > 5 * 60) {
    throw new HttpsError("failed-precondition", "Please confirm your identity again, then retry.");
  }

  await wipeAccount(uid);
  logger.info("Account deleted", { uid });
  return { deleted: true };
});

export { convertDocument } from "./convert";
export { openShare, revokeShare, saveShare, sharedWithMe, shareFileUrl } from "./shares";
export { adminApi } from "./admin";
export { computeStatsHourly } from "./stats";
export { reportClientError } from "./ops";
