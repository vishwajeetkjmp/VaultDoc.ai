/**
 * Reads and writes the Secure Vault in Firebase. Everything stored is
 * ciphertext: file bytes, names, types and real sizes are encrypted in the
 * browser (see crypto.ts) before they leave it.
 *
 *   users/{uid}/vault/meta            wrapped vault key (needs the recovery key to open)
 *   users/{uid}/vaultItems/{id}       encrypted file/folder record
 *   Storage users/{uid}/vault/{id}    encrypted file bytes
 */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { getBytes, ref, uploadBytesResumable } from "firebase/storage";
import { bucket, db } from "../files/cloud";
import { childPlacement, cleanName, FolderRef, Item } from "../files/items";
import {
  decryptBytes,
  decryptJson,
  encryptBytes,
  encryptJson,
  fromBase64,
  generateFileKey,
  generateRecoveryKey,
  generateVaultKey,
  parseRecoveryKey,
  recoveryWrappingKey,
  toBase64,
  unwrapKey,
  wrapKey,
} from "./crypto";

const metaRef = (uid: string) => doc(db(), "users", uid, "vault", "meta");
const itemsCol = (uid: string) => collection(db(), "users", uid, "vaultItems");

// ---------- setup and recovery ----------

export async function vaultExists(uid: string): Promise<boolean> {
  return (await getDoc(metaRef(uid))).exists();
}

/**
 * Creates the vault: a new vault key, protected by a new recovery key.
 * Returns the recovery key text (to show the user once) and the vault key.
 * The server receives only the vault key wrapped by the recovery key.
 */
export async function createVault(uid: string) {
  const vaultKey = await generateVaultKey();
  const recovery = generateRecoveryKey();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const wrappedVaultKey = await wrapKey(vaultKey, await recoveryWrappingKey(recovery.bytes, salt));
  return {
    vaultKey,
    recoveryText: recovery.text,
    /** Call once the user has saved the recovery key */
    save: () =>
      setDoc(metaRef(uid), { version: 1, salt: toBase64(salt), wrappedVaultKey, createdAt: serverTimestamp() }),
  };
}

/** Opens the vault with the recovery key (new device). Returns an extractable vault key, or null if the key is wrong. */
export async function openWithRecoveryKey(uid: string, recoveryText: string): Promise<CryptoKey | null> {
  const bytes = parseRecoveryKey(recoveryText);
  if (!bytes) return null;
  const meta = await getDoc(metaRef(uid));
  if (!meta.exists()) return null;
  try {
    const wrapping = await recoveryWrappingKey(bytes, fromBase64(meta.get("salt")));
    return await unwrapKey(meta.get("wrappedVaultKey"), wrapping, { extractable: true });
  } catch {
    return null; // AES-GCM refuses the wrong key
  }
}

/** Deletes every vault item and the vault itself. Used when the recovery key is lost. */
export async function eraseVault(uid: string) {
  const all = await getDocs(itemsCol(uid));
  for (let i = 0; i < all.docs.length; i += 450) {
    const batch = writeBatch(db());
    all.docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  await deleteDoc(metaRef(uid));
}

// ---------- items ----------

type EncryptedMeta = { name: string; contentType: string | null; size: number };

/** A vault item decrypted for display, shaped like a My Files item so the same list UI works. */
export type VaultItem = Item & { wrappedKey: string | null };

const toDate = (v: unknown) => (v instanceof Timestamp ? v.toDate() : new Date());

/** Live, decrypted contents of a vault folder. */
export function listenVaultFolder(
  uid: string,
  vaultKey: CryptoKey,
  folderId: string,
  onItems: (items: VaultItem[]) => void,
  onError: (e: Error) => void,
) {
  return onSnapshot(
    query(itemsCol(uid), where("parentId", "==", folderId)),
    async (snap) => {
      const items = await Promise.all(
        snap.docs.map(async (d): Promise<VaultItem> => {
          const data = d.data();
          let meta: EncryptedMeta = { name: "🔒 Unreadable item", contentType: null, size: 0 };
          try {
            meta = await decryptJson<EncryptedMeta>(vaultKey, data.encMeta);
          } catch {
            // Tampered or from another vault key; shown but not openable
          }
          return {
            id: d.id,
            kind: data.kind === "folder" ? "folder" : "file",
            name: meta.name,
            parentId: data.parentId,
            ancestorIds: data.ancestorIds ?? [],
            size: meta.size,
            contentType: meta.contentType,
            sha256: null,
            status: data.status === "ready" ? "ready" : "uploading",
            storagePath: data.storagePath ?? null,
            createdAt: toDate(data.createdAt),
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : null,
            wrappedKey: data.wrappedKey ?? null,
          };
        }),
      );
      onItems(items);
    },
    onError,
  );
}

export async function getVaultFolder(uid: string, vaultKey: CryptoKey, id: string): Promise<VaultItem | null> {
  const snap = await getDoc(doc(itemsCol(uid), id));
  if (!snap.exists()) return null;
  const meta = await decryptJson<EncryptedMeta>(vaultKey, snap.get("encMeta")).catch(() => null);
  if (!meta) return null;
  return {
    id,
    kind: "folder",
    name: meta.name,
    parentId: snap.get("parentId"),
    ancestorIds: snap.get("ancestorIds") ?? [],
    size: 0,
    contentType: null,
    sha256: null,
    status: "ready",
    storagePath: null,
    createdAt: null,
    updatedAt: null,
    wrappedKey: null,
  };
}

export async function createVaultFolder(uid: string, vaultKey: CryptoKey, parent: FolderRef, name: string) {
  const ref_ = doc(itemsCol(uid));
  const clean = cleanName(name) || "Untitled folder";
  await setDoc(ref_, {
    kind: "folder",
    ...childPlacement(parent),
    encMeta: await encryptJson(vaultKey, { name: clean, contentType: null, size: 0 } satisfies EncryptedMeta),
    status: "ready",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function renameVaultItem(uid: string, vaultKey: CryptoKey, item: VaultItem, name: string) {
  const clean = cleanName(name);
  if (!clean) return;
  await updateDoc(doc(itemsCol(uid), item.id), {
    encMeta: await encryptJson(vaultKey, { name: clean, contentType: item.contentType, size: item.size } satisfies EncryptedMeta),
    updatedAt: serverTimestamp(),
  });
}

/** Deletes items (folders with everything inside). Stored bytes and usage are cleaned up by a Cloud Function. */
export async function deleteVaultItems(uid: string, items: VaultItem[]) {
  const ids = new Set(items.map((i) => i.id));
  for (const folder of items.filter((i) => i.kind === "folder")) {
    const inside = await getDocs(query(itemsCol(uid), where("ancestorIds", "array-contains", folder.id)));
    inside.docs.forEach((d) => ids.add(d.id));
  }
  const all = Array.from(ids);
  for (let i = 0; i < all.length; i += 450) {
    const batch = writeBatch(db());
    all.slice(i, i + 450).forEach((id) => batch.delete(doc(itemsCol(uid), id)));
    await batch.commit();
  }
}

/** Encrypts a file in the browser and uploads only the ciphertext. */
export async function uploadVaultFile(
  uid: string,
  vaultKey: CryptoKey,
  folder: FolderRef,
  file: { name: string; contentType: string; data: Blob },
  onProgress: (fraction: number) => void,
) {
  const fileKey = await generateFileKey();
  const cipher = await encryptBytes(fileKey, await file.data.arrayBuffer());
  const itemRef = doc(itemsCol(uid));
  const storagePath = `users/${uid}/vault/${itemRef.id}`;

  await setDoc(itemRef, {
    kind: "file",
    ...childPlacement(folder),
    encMeta: await encryptJson(vaultKey, {
      name: cleanName(file.name),
      contentType: file.contentType,
      size: file.data.size,
    } satisfies EncryptedMeta),
    wrappedKey: await wrapKey(fileKey, vaultKey),
    size: cipher.byteLength, // the server only knows the encrypted size
    status: "uploading",
    storagePath,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    const task = uploadBytesResumable(ref(bucket(), storagePath), cipher, { contentType: "application/octet-stream" });
    await new Promise<void>((resolve, reject) =>
      task.on("state_changed", (s) => onProgress(s.bytesTransferred / s.totalBytes), reject, resolve),
    );
  } catch (e) {
    await deleteDoc(itemRef).catch(() => {});
    throw e;
  }
}

/** Downloads, decrypts in memory, and opens or saves a vault file. */
export async function openVaultFile(vaultKey: CryptoKey, item: VaultItem, mode: "open" | "download") {
  if (!item.storagePath || !item.wrappedKey) return;
  const tab = mode === "open" ? window.open("", "_blank") : null;
  try {
    const fileKey = await unwrapKey(item.wrappedKey, vaultKey, { usages: ["encrypt", "decrypt"] });
    const cipher = new Uint8Array(await getBytes(ref(bucket(), item.storagePath)));
    const plain = await decryptBytes(fileKey, cipher);
    const url = URL.createObjectURL(new Blob([plain], { type: item.contentType ?? "application/octet-stream" }));
    if (tab) {
      tab.location.href = url;
    } else {
      const a = document.createElement("a");
      a.href = url;
      a.download = item.name;
      a.click();
    }
    // Short-lived: the decrypted copy shouldn't outlive its use
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  } catch (e) {
    tab?.close();
    throw e;
  }
}
