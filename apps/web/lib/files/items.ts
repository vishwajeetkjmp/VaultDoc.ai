import {
  collection,
  doc,
  DocumentSnapshot,
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
import { getBlob, ref } from "firebase/storage";
import { bucket, db } from "./cloud";

export const ROOT_ID = "root";

export type Item = {
  id: string;
  kind: "file" | "folder";
  name: string;
  parentId: string;
  ancestorIds: string[];
  size: number;
  contentType: string | null;
  sha256: string | null;
  status: "uploading" | "ready";
  storagePath: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

/** Where new items go: a folder's id plus the ids above it (for breadcrumbs and folder deletes). */
export type FolderRef = { id: string; ancestorIds: string[] };

export const ROOT_FOLDER: FolderRef = { id: ROOT_ID, ancestorIds: [] };

export function childPlacement(folder: FolderRef) {
  return {
    parentId: folder.id,
    ancestorIds: folder.id === ROOT_ID ? [] : [...folder.ancestorIds, folder.id],
  };
}

export function itemsCollection(uid: string) {
  return collection(db(), "users", uid, "items");
}

export function newItemId(uid: string): string {
  return doc(itemsCollection(uid)).id;
}

const toDate = (v: unknown) => (v instanceof Timestamp ? v.toDate() : null);

function fromDoc(snap: DocumentSnapshot): Item {
  const d = snap.data() ?? {};
  return {
    id: snap.id,
    kind: d.kind === "folder" ? "folder" : "file",
    name: String(d.name ?? ""),
    parentId: String(d.parentId ?? ROOT_ID),
    ancestorIds: Array.isArray(d.ancestorIds) ? d.ancestorIds : [],
    size: Number(d.size) || 0,
    contentType: d.contentType ?? null,
    sha256: d.sha256 ?? null,
    status: d.status === "ready" ? "ready" : "uploading",
    storagePath: d.storagePath ?? null,
    // Pending server timestamps read as null until the write lands; use "now" meanwhile
    createdAt: toDate(d.createdAt) ?? new Date(),
    updatedAt: toDate(d.updatedAt),
  };
}

/** Latest known contents per folder, so uploads can spot duplicates without another read. */
const folderCache = new Map<string, Item[]>();

export function cachedFolderItems(folderId: string): Item[] {
  return folderCache.get(folderId) ?? [];
}

/** Live contents of one folder. Served from the local cache first, so revisits are instant. */
export function listenFolder(
  uid: string,
  folderId: string,
  onItems: (items: Item[], fromCache: boolean) => void,
  onError: (e: Error) => void,
) {
  const q = query(itemsCollection(uid), where("parentId", "==", folderId));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map(fromDoc);
      folderCache.set(folderId, items);
      onItems(items, snap.metadata.fromCache);
    },
    onError,
  );
}

export async function getItem(uid: string, id: string): Promise<Item | null> {
  const snap = await getDoc(doc(itemsCollection(uid), id));
  return snap.exists() ? fromDoc(snap) : null;
}

/** Folder chain from the top down to (and including) `folder`, for breadcrumbs. */
export async function getFolderChain(uid: string, folder: Item): Promise<Item[]> {
  const ancestors = await Promise.all(folder.ancestorIds.map((id) => getItem(uid, id)));
  return [...ancestors.filter((a): a is Item => a !== null), folder];
}

/** "Report", "Report (2)", "Report (3)" … — avoids clashing with names already in the folder. */
export function uniqueName(base: string, taken: Iterable<string>): string {
  const names = new Set(Array.from(taken, (n) => n.toLowerCase()));
  if (!names.has(base.toLowerCase())) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base} (${i})`;
    if (!names.has(candidate.toLowerCase())) return candidate;
  }
}

export function cleanName(name: string): string {
  return name.replace(/[/\\]/g, "-").replace(/\s+/g, " ").trim().slice(0, 255);
}

export async function createFolder(uid: string, parent: FolderRef, name: string): Promise<FolderRef> {
  const id = newItemId(uid);
  const placement = childPlacement(parent);
  const clean = cleanName(name) || "Untitled folder";
  // Not awaited: the local cache shows the folder at once, the write syncs in the background
  setDoc(doc(itemsCollection(uid), id), {
    kind: "folder",
    name: clean,
    nameLower: clean.toLowerCase(),
    ...placement,
    status: "ready",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }).catch((e) => console.error("Creating folder failed", e));
  return { id, ancestorIds: placement.ancestorIds };
}

export function renameItem(uid: string, id: string, name: string) {
  const clean = cleanName(name);
  if (!clean) return Promise.resolve();
  return updateDoc(doc(itemsCollection(uid), id), {
    name: clean,
    nameLower: clean.toLowerCase(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Deletes files and folders (with everything inside them). Stored files and
 * the storage total are cleaned up by a Cloud Function.
 */
export async function deleteItems(uid: string, items: Item[]) {
  const ids = new Set(items.map((i) => i.id));
  for (const folder of items.filter((i) => i.kind === "folder")) {
    const inside = await getDocs(query(itemsCollection(uid), where("ancestorIds", "array-contains", folder.id)));
    inside.docs.forEach((d) => ids.add(d.id));
  }
  const all = Array.from(ids);
  for (let i = 0; i < all.length; i += 450) {
    const batch = writeBatch(db());
    all.slice(i, i + 450).forEach((id) => batch.delete(doc(itemsCollection(uid), id)));
    await batch.commit();
  }
}

/**
 * Opens a file in a new tab (PDFs and images display in the browser) or
 * downloads it. Fetched through the signed-in user's session rather than a
 * shareable public link, so files stay private.
 */
export async function openFile(item: Item, mode: "open" | "download") {
  if (!item.storagePath) return;
  // Open the tab right away (popup blockers only allow it during the click), fill it in once loaded
  const tab = mode === "open" ? window.open("", "_blank") : null;
  try {
    const blob = await getBlob(ref(bucket(), item.storagePath));
    const typed = item.contentType ? new Blob([blob], { type: item.contentType }) : blob;
    const url = URL.createObjectURL(typed);
    if (tab) {
      tab.location.href = url;
    } else {
      const a = document.createElement("a");
      a.href = url;
      a.download = item.name;
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    tab?.close();
    throw e;
  }
}

/** Everything inside a folder, at every level (for "Download as ZIP"). */
export async function listFolderTree(uid: string, folderId: string): Promise<Item[]> {
  const snap = await getDocs(query(itemsCollection(uid), where("ancestorIds", "array-contains", folderId)));
  return snap.docs.map(fromDoc).filter((i) => i.status === "ready");
}

/** A file's bytes, read with the owner's session. */
export async function fileBytes(item: Item): Promise<Uint8Array> {
  const blob = await getBlob(ref(bucket(), item.storagePath!));
  return new Uint8Array(await blob.arrayBuffer());
}
