import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { setGlobalOptions, logger } from "firebase-functions/v2";
import { onObjectFinalized } from "firebase-functions/v2/storage";
import { onDocumentDeleted } from "firebase-functions/v2/firestore";

initializeApp();
const db = getFirestore();

// Same region as the Firestore database and Storage bucket (Delhi)
setGlobalOptions({ region: "asia-south2", maxInstances: 10 });

const FILE_PATH = /^users\/([^/]+)\/files\/([^/]+)$/;

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
  const [, uid, itemId] = match;
  const size = Number(event.data.size);

  const itemRef = db.doc(`users/${uid}/items/${itemId}`);
  const userRef = db.doc(`users/${uid}`);
  const configRef = db.doc("config/limits");

  const orphan = await db.runTransaction(async (tx) => {
    const [item, user, config] = await Promise.all([tx.get(itemRef), tx.get(userRef), tx.get(configRef)]);
    if (!item.exists) return true; // record was deleted (e.g. upload cancelled)
    if (item.get("status") === "ready") return false; // already counted (event retried)

    const maxFileBytes = Number(config.get("maxFileBytes")) || DEFAULT_MAX_FILE_BYTES;
    const quotaBytes = Number(user.get("quotaBytes")) || Number(config.get("quotaBytes")) || DEFAULT_QUOTA_BYTES;
    const usedBytes = Number(user.get("usedBytes")) || 0;
    if (size > maxFileBytes || usedBytes + size > quotaBytes) {
      logger.warn("Upload over limit, removing", { uid, itemId, size, usedBytes, quotaBytes, maxFileBytes });
      tx.delete(itemRef); // onItemDeleted removes the stored file
      return false;
    }

    tx.update(itemRef, {
      status: "ready",
      size,
      contentType: event.data.contentType ?? null,
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
export const onItemDeleted = onDocumentDeleted("users/{uid}/items/{itemId}", async (event) => {
  const data = event.data?.data();
  if (!data || data.kind !== "file") return;
  const { uid } = event.params;

  if (typeof data.storagePath === "string") {
    await getStorage().bucket().file(data.storagePath).delete({ ignoreNotFound: true });
  }

  if (data.status !== "ready") return; // never counted
  const size = Number(data.size) || 0;
  const userRef = db.doc(`users/${uid}`);
  const eventRef = db.doc(`users/${uid}/_events/${event.id}`);

  await db.runTransaction(async (tx) => {
    if ((await tx.get(eventRef)).exists) return;
    tx.create(eventRef, { at: FieldValue.serverTimestamp() });
    tx.set(
      userRef,
      { usedBytes: FieldValue.increment(-size), fileCount: FieldValue.increment(-1) },
      { merge: true },
    );
  });
});
