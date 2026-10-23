import { call } from "../callable";

/**
 * Sharing My Space items. All changes go through Cloud Functions (see functions/src/shares.ts).
 * No Firestore import here, so the shared-link page stays light; the owner's live list is in myShares.ts.
 */

export type ShareMode = "link" | "invite";

export type MyShare = {
  linkId: string;
  itemId: string;
  itemKind: "file" | "folder";
  itemName: string;
  mode: ShareMode;
  invitees: string[];
  expiresAt: Date | null;
  views: number;
  downloads: number;
  lastOpenedAt: Date | null;
  createdAt: Date | null;
};

export type SharedWithMe = {
  linkId: string;
  itemName: string;
  itemKind: "file" | "folder";
  ownerName: string;
  ownerEmail: string;
  sharedAt: number | null;
  expiresAt: number | null;
};

export type SharedItem = { id: string; kind: "file" | "folder"; name: string; parentId: string; size: number; contentType: string | null };

export type OpenedShare = {
  mode: ShareMode;
  ownerName: string;
  expiresAt: number | null;
  isOwner: boolean;
  root: SharedItem;
  items: SharedItem[];
  truncated: boolean;
};

export const shareUrl = (linkId: string) => `${window.location.origin}/s/${linkId}`;

export const saveShare = (input: { itemId: string; mode: ShareMode; invitees: string[]; expiresAt: number | null; message?: string }) =>
  call<typeof input, { linkId: string; url: string; emailed: number; emailFailed: number }>("saveShare", input);

export const revokeShare = (linkId: string) => call<{ linkId: string }, { ok: boolean }>("revokeShare", { linkId });

export const listSharedWithMe = () => call<Record<string, never>, { shares: SharedWithMe[] }>("sharedWithMe", {}).then((r) => r.shares);

export const openShare = (linkId: string) => call<{ linkId: string }, OpenedShare>("openShare", { linkId });

/** A short-lived link to one shared file (or, on the emulators, its bytes). */
export async function sharedFileBlobOrUrl(
  linkId: string,
  itemId: string,
  opts: { download: boolean; count?: boolean },
): Promise<{ url?: string; blob?: Blob; name?: string }> {
  const r = await call<object, { url?: string; data?: string; contentType?: string; name?: string }>("shareFileUrl", {
    linkId,
    itemId,
    download: opts.download,
    count: !!opts.count,
  });
  if (r.url) return { url: r.url, name: r.name };
  const bytes = Uint8Array.from(atob(r.data ?? ""), (c) => c.charCodeAt(0));
  return { blob: new Blob([bytes], { type: r.contentType }), name: r.name };
}

/** Fetches a shared file's bytes (for ZIPs). */
export async function sharedFileBytes(linkId: string, itemId: string, count: boolean): Promise<Uint8Array> {
  const r = await sharedFileBlobOrUrl(linkId, itemId, { download: true, count });
  if (r.blob) return new Uint8Array(await r.blob.arrayBuffer());
  const res = await fetch(r.url!);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}
