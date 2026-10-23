import { Zip, ZipPassThrough } from "fflate";

/**
 * Builds a ZIP in the browser and saves it. Files are fetched a few at a time and stored
 * without recompression (documents and photos are already compressed), which keeps it fast.
 * Loaded only when someone downloads a folder.
 */
export type ZipEntry = { path: string; size: number; load: () => Promise<Uint8Array> };

export const ZIP_MAX_BYTES = 500 * 1024 * 1024;
export const ZIP_MAX_FILES = 1000;
const PARALLEL = 3;

export async function downloadZip(
  zipName: string,
  entries: ZipEntry[],
  onProgress: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const total = entries.reduce((s, e) => s + e.size, 0);
  if (entries.length > ZIP_MAX_FILES || total > ZIP_MAX_BYTES) {
    throw new Error("This folder is too big to download as one ZIP (500 MB / 1,000 files). Download the files separately.");
  }

  const parts: Uint8Array[] = [];
  let zipError: Error | null = null;
  const zip = new Zip((err, chunk) => {
    if (err) zipError = err;
    else parts.push(chunk);
  });

  // Fetch in parallel, but add to the ZIP in order
  const loaded: (Uint8Array | undefined)[] = new Array(entries.length);
  let next = 0;
  let written = 0;
  let doneBytes = 0;
  const flush = () => {
    while (written < entries.length && loaded[written]) {
      const file = new ZipPassThrough(entries[written].path);
      zip.add(file);
      file.push(loaded[written]!, true);
      loaded[written] = undefined; // free memory once written
      written++;
    }
  };
  const worker = async () => {
    while (next < entries.length) {
      if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
      const i = next++;
      loaded[i] = await entries[i].load();
      doneBytes += entries[i].size;
      onProgress(doneBytes, total);
      flush();
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, entries.length) }, worker));
  flush();
  zip.end();
  if (zipError) throw zipError;

  const url = URL.createObjectURL(new Blob(parts, { type: "application/zip" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = zipName.endsWith(".zip") ? zipName : `${zipName}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Paths inside the ZIP ("Folder/Sub/file.pdf") from a flat list with parent ids. */
export function zipPaths<T extends { id: string; kind: string; name: string; parentId: string }>(rootId: string, items: T[]) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const pathOf = (item: T): string => {
    const parts = [item.name];
    let parent = byId.get(item.parentId);
    while (parent && parent.id !== rootId) {
      parts.unshift(parent.name);
      parent = byId.get(parent.parentId);
    }
    return parts.join("/");
  };
  // Same name twice in one folder: add (2), (3)... so nothing is overwritten
  const seen = new Map<string, number>();
  return items
    .filter((i) => i.kind === "file")
    .map((item) => {
      let path = pathOf(item);
      const n = seen.get(path.toLowerCase()) ?? 0;
      seen.set(path.toLowerCase(), n + 1);
      if (n) path = path.replace(/(\.[^./]+)?$/, ` (${n + 1})$1`);
      return { item, path };
    });
}
