import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { setGlobalOptions, logger } from "firebase-functions/v2";
import { onObjectFinalized } from "firebase-functions/v2/storage";
import { onDocumentDeleted } from "firebase-functions/v2/firestore";

initializeApp();
const db = getFirestore();

// Same region as the Firestore database and Storage bucket (Mumbai)
setGlobalOptions({ region: "asia-south1", maxInstances: 10 });

const FILE_PATH = /^users\/([^/]+)\/files\/([^/]+)$/;

/**
 * A file finished uploading: mark its record ready with the real size and
 * add it to the owner's storage total. The app can't write usage itself,
 * so this is the only place the total goes up.
 */
export const onFileUploaded = onObjectFinalized(async (event) => {
  const match = FILE_PATH.exec(event.data.name);
  if (!match) return;
  const [, uid, itemId] = match;
  const size = Number(event.data.size);

  const itemRef = db.doc(`users/${uid}/items/${itemId}`);
  const userRef = db.doc(`users/${uid}`);

  const orphan = await db.runTransaction(async (tx) => {
    const item = await tx.get(itemRef);
    if (!item.exists) return true; // record was deleted (e.g. upload cancelled)
    if (item.get("status") === "ready") return false; // already counted (event retried)

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
