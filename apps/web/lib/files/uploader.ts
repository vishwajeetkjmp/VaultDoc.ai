"use client";

import { useMemo, useSyncExternalStore } from "react";
import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, UploadTask } from "firebase/storage";
import { FirebaseError } from "firebase/app";
import { bucket } from "./cloud";
import { isZip, typeInfo } from "./fileTypes";
import { formatBytes } from "./format";
import {
  cachedFolderItems,
  childPlacement,
  createFolder,
  FolderRef,
  itemsCollection,
  newItemId,
  uniqueName,
} from "./items";
import type { Limits } from "./limits";

export type UploadState = "queued" | "checking" | "uploading" | "done" | "skipped" | "failed" | "cancelled";

export type Upload = {
  key: string;
  name: string;
  size: number;
  state: UploadState;
  progress: number; // 0..1
  message?: string;
  itemId?: string;
  isZip?: boolean;
};

export type UploadContext = {
  uid: string;
  folder: FolderRef;
  /** Latest usage, read when files are added */
  account: () => { usedBytes: number; quotaBytes: number; limits: Limits };
};

type Job = {
  key: string;
  uid: string;
  folder: FolderRef;
  name: string;
  contentType: string;
  data: Blob;
  sha256?: string;
  task?: UploadTask;
  cancelled?: boolean;
};

const CONCURRENCY = 3;
const FINISHED: UploadState[] = ["done", "skipped", "failed", "cancelled"];

async function sha256(data: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await data.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function explain(e: unknown): string {
  const code = e instanceof FirebaseError ? e.code : "";
  // Size, type and quota are checked before uploading, so a refusal here usually means
  // the limits changed on the server or permissions aren't set up
  if (code === "storage/unauthorized" || code === "permission-denied") return "Upload refused by the server. Try again shortly";
  if (code === "storage/retry-limit-exceeded" || code === "unavailable") return "Network problem. Try again";
  if (code === "storage/quota-exceeded") return "Storage is full";
  return "Upload failed";
}

/**
 * Upload queue shared by the whole tab. Checks that can fail fast (type,
 * size, free space) run before any network request; then files are hashed
 * to skip exact duplicates and uploaded a few at a time.
 */
class UploadQueue {
  private uploads: Upload[] = [];
  private jobs = new Map<string, Job>();
  private waiting: Job[] = [];
  private running = 0;
  private reserved = 0; // bytes queued or in flight, counted against free space
  private listeners = new Set<() => void>();
  private frame = 0;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.uploads;

  /** At most one re-render per animation frame, however many progress events arrive */
  private notify() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.listeners.forEach((l) => l());
    });
  }

  private add(upload: Upload) {
    this.uploads = [...this.uploads, upload];
    this.notify();
  }

  private patch(key: string, changes: Partial<Upload>) {
    this.uploads = this.uploads.map((u) => (u.key === key ? { ...u, ...changes } : u));
    this.notify();
  }

  get activeCount() {
    return this.uploads.filter((u) => !FINISHED.includes(u.state)).length;
  }

  /**
   * Files still on their way, so the list can show them before the server
   * marks them ready. Returned as a stable string so subscribers only
   * re-render when the set changes, not on every progress tick.
   */
  getPendingKey = () => {
    const ids = this.uploads
      .filter((u) => u.itemId && (u.state === "uploading" || u.state === "done"))
      .map((u) => u.itemId!)
      .join(",");
    return ids;
  };

  addFiles(files: File[], ctx: UploadContext) {
    for (const file of files) {
      if (isZip(file.name)) this.addZip(file, ctx);
      else this.addFile(file, file.name, ctx.folder, ctx);
    }
  }

  /** Returns why a file can't be uploaded, without touching the network */
  private precheck(name: string, size: number, ctx: UploadContext): string | null {
    const { usedBytes, quotaBytes, limits } = ctx.account();
    if (!typeInfo(name)) return "Unsupported file type";
    if (size === 0) return "File is empty";
    if (size > limits.maxFileBytes) {
      return `Too large (${formatBytes(size)}). Max ${formatBytes(limits.maxFileBytes)} per file`;
    }
    if (usedBytes + this.reserved + size > quotaBytes) return "Not enough storage left";
    return null;
  }

  private addFile(data: Blob, name: string, folder: FolderRef, ctx: UploadContext) {
    const key = crypto.randomUUID();
    const problem = this.precheck(name, data.size, ctx);
    if (problem) {
      this.add({ key, name, size: data.size, state: "failed", progress: 0, message: problem });
      return;
    }
    this.reserved += data.size;
    const job: Job = { key, uid: ctx.uid, folder, name, contentType: typeInfo(name)!.contentType, data };
    this.jobs.set(key, job);
    this.waiting.push(job);
    this.add({ key, name, size: data.size, state: "queued", progress: 0 });
    this.pump();
  }

  private async addZip(file: File, ctx: UploadContext) {
    const key = crypto.randomUUID();
    const { usedBytes, quotaBytes, limits } = ctx.account();
    const base = { key, name: file.name, size: file.size, progress: 0, isZip: true };
    if (file.size > limits.maxZipBytes) {
      this.add({ ...base, state: "failed", message: `ZIP too large (${formatBytes(file.size)}). Max ${formatBytes(limits.maxZipBytes)}` });
      return;
    }
    this.add({ ...base, state: "checking", message: "Unpacking…" });

    try {
      const free = quotaBytes - usedBytes - this.reserved;
      // The unzip library is only downloaded when someone actually uploads a ZIP
      const { readZip } = await import("./zip");
      const { entries, skipped } = await readZip(file, limits, free);
      const skippedNote = skipped.length ? ` · ${skipped.length} skipped (unsupported or too large)` : "";
      if (!entries.length) {
        this.patch(key, { state: "failed", message: `No supported files inside${skippedNote}` });
        return;
      }

      // Recreate the ZIP's folders inside a new folder named after it
      const zipName = file.name.replace(/\.zip$/i, "");
      const taken = cachedFolderItems(ctx.folder.id).map((i) => i.name);
      const top = await createFolder(ctx.uid, ctx.folder, uniqueName(zipName, taken));
      const folders = new Map<string, FolderRef>([["", top]]);
      const folderFor = async (parts: string[]) => {
        let path = "";
        let current = top;
        for (const part of parts) {
          path += "/" + part;
          let next = folders.get(path);
          if (!next) {
            next = await createFolder(ctx.uid, current, part);
            folders.set(path, next);
          }
          current = next;
        }
        return current;
      };

      for (const entry of entries) {
        const target = await folderFor(entry.folders);
        this.addFile(new Blob([entry.data]), entry.name, target, ctx);
      }
      this.patch(key, {
        state: "done",
        progress: 1,
        message: `Unpacked ${entries.length} file${entries.length === 1 ? "" : "s"} into “${zipName}”${skippedNote}`,
      });
    } catch (e) {
      this.patch(key, { state: "failed", message: e instanceof Error ? e.message : "Couldn't read ZIP" });
    }
  }

  private pump() {
    while (this.running < CONCURRENCY && this.waiting.length) {
      const job = this.waiting.shift()!;
      this.running++;
      this.run(job).finally(() => {
        this.running--;
        this.reserved -= job.data.size;
        this.jobs.delete(job.key);
        this.pump();
      });
    }
  }

  private isDuplicate(job: Job) {
    const sameFile = (name: string, hash: string | null | undefined) =>
      hash === job.sha256 && name.toLowerCase() === job.name.toLowerCase();
    return (
      cachedFolderItems(job.folder.id).some((i) => i.kind === "file" && sameFile(i.name, i.sha256)) ||
      Array.from(this.jobs.values()).some(
        (other) => other !== job && other.folder.id === job.folder.id && sameFile(other.name, other.sha256),
      )
    );
  }

  private async run(job: Job) {
    const { key, uid } = job;
    let itemId: string | undefined;
    let step = "preparing"; // reported if something fails, to tell a refused record from a refused upload
    try {
      this.patch(key, { state: "checking", message: undefined });
      job.sha256 = await sha256(job.data);
      if (job.cancelled) return;
      if (this.isDuplicate(job)) {
        this.patch(key, { state: "skipped", message: "Already in this folder" });
        return;
      }

      step = "saving record";
      itemId = newItemId(uid);
      const storagePath = `users/${uid}/files/${itemId}`;
      // The record must exist before the upload finishes; the server checks for it
      await setDoc(doc(itemsCollection(uid), itemId), {
        kind: "file",
        name: job.name,
        nameLower: job.name.toLowerCase(),
        ...childPlacement(job.folder),
        size: job.data.size,
        contentType: job.contentType,
        sha256: job.sha256,
        status: "uploading",
        storagePath,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      if (job.cancelled) throw new Error("cancelled");

      step = "uploading";
      this.patch(key, { state: "uploading", itemId });
      job.task = uploadBytesResumable(ref(bucket(), storagePath), job.data, { contentType: job.contentType });
      await new Promise<void>((resolve, reject) => {
        job.task!.on(
          "state_changed",
          (s) => this.patch(key, { progress: s.bytesTransferred / s.totalBytes }),
          reject,
          resolve,
        );
      });
      this.patch(key, { state: "done", progress: 1 });
    } catch (e) {
      if (itemId) deleteDoc(doc(itemsCollection(uid), itemId)).catch(() => {});
      if (job.cancelled) {
        this.patch(key, { state: "cancelled", message: undefined });
      } else {
        const code = e instanceof FirebaseError ? e.code : "unknown";
        console.error(`[VaultDoc] Upload of "${job.name}" failed while ${step}:`, code, e,
          (e as { customData?: { serverResponse?: string } })?.customData?.serverResponse ?? "");
        this.patch(key, { state: "failed", message: `${explain(e)} (${step}: ${code})` });
      }
    }
  }

  cancel(key: string) {
    const job = this.jobs.get(key);
    if (!job) return;
    job.cancelled = true;
    const queued = this.waiting.indexOf(job);
    if (queued >= 0) {
      this.waiting.splice(queued, 1);
      this.reserved -= job.data.size;
      this.jobs.delete(key);
      this.patch(key, { state: "cancelled" });
    } else {
      job.task?.cancel();
    }
  }

  cancelAll() {
    Array.from(this.jobs.keys()).forEach((k) => this.cancel(k));
  }

  clearFinished() {
    this.uploads = this.uploads.filter((u) => !FINISHED.includes(u.state));
    this.notify();
  }
}

export const uploadQueue = new UploadQueue();

const EMPTY: Upload[] = [];

export function useUploads(): Upload[] {
  return useSyncExternalStore(uploadQueue.subscribe, uploadQueue.getSnapshot, () => EMPTY);
}

export function usePendingItemIds(): Set<string> {
  const key = useSyncExternalStore(uploadQueue.subscribe, uploadQueue.getPendingKey, () => "");
  return useMemo(() => new Set(key ? key.split(",") : []), [key]);
}
