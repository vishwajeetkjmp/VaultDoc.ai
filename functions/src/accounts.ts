import "./setup";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { deleteSharesOfUser } from "./shares";

// Marks an account as deleted, so the upload/delete triggers don't recreate its usage records
// while its data is being removed. Holds only the uid and a timestamp.
export const deletedUserRef = (uid: string) => getFirestore().doc(`deletedUsers/${uid}`);

/**
 * Removes an account and everything in it: shares, My Space and Secure Vault files, their records,
 * the usage record and the login itself. Used by "Delete account" and by admins (owner only).
 */
export async function wipeAccount(uid: string) {
  const db = getFirestore();
  await deletedUserRef(uid).set({ at: FieldValue.serverTimestamp() });
  await deleteSharesOfUser(uid);
  await getStorage().bucket().deleteFiles({ prefix: `users/${uid}/` });
  await db.recursiveDelete(db.doc(`users/${uid}`));
  // AI usage records live outside users/{uid} (admin cost views)
  const usage = await Promise.all(["aiUsage", "aiMonthly"].map((c) => db.collection(c).where("uid", "==", uid).get()));
  await Promise.all(usage.flatMap((s) => s.docs.map((d) => d.ref.delete())));
  await getAuth().deleteUser(uid);
}
