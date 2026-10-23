import { unzip, UnzipFileInfo } from "fflate";
import { typeInfo } from "./fileTypes";
import { formatBytes } from "./format";
import type { Limits } from "./limits";

export type ZipEntry = { folders: string[]; name: string; data: Uint8Array };
export type ZipSkip = { name: string; reason: string };

const JUNK = /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db|desktop\.ini)(\/|$)|(^|\/)\./;

/**
 * Unpacks a ZIP in the browser. Every entry's size is checked from the ZIP's
 * index *before* anything is decompressed, so oversized or "zip bomb"
 * archives are rejected without doing the work.
 */
export async function readZip(file: File, limits: Limits, freeBytes: number) {
  const buffer = new Uint8Array(await file.arrayBuffer());
  const skipped: ZipSkip[] = [];
  let count = 0;
  let total = 0;
  let tooBig: string | null = null;

  const wanted = (info: UnzipFileInfo) => {
    const path = info.name;
    if (path.endsWith("/") || JUNK.test(path)) return false;
    const name = path.split("/").pop() ?? path;
    if (!typeInfo(name)) {
      skipped.push({ name, reason: "Unsupported type" });
      return false;
    }
    if (info.originalSize > limits.maxFileBytes) {
      skipped.push({ name, reason: `Too large (${formatBytes(info.originalSize)})` });
      return false;
    }
    count++;
    total += info.originalSize;
    if (count > limits.maxZipEntries) tooBig = `More than ${limits.maxZipEntries} files in the ZIP`;
    else if (total > freeBytes) tooBig = `Contents (${formatBytes(total)}+) exceed your free space`;
    return !tooBig;
  };

  const files = await new Promise<Record<string, Uint8Array>>((resolve, reject) =>
    unzip(buffer, { filter: wanted }, (err, out) => (err ? reject(new Error("Not a valid ZIP file")) : resolve(out))),
  );
  if (tooBig) throw new Error(tooBig);

  const entries: ZipEntry[] = [];
  for (const [path, data] of Object.entries(files)) {
    const parts = path.split("/").filter(Boolean);
    const name = parts.pop()!;
    // The index can lie about sizes; check the real thing too
    if (data.byteLength > limits.maxFileBytes) {
      skipped.push({ name, reason: `Too large (${formatBytes(data.byteLength)})` });
      continue;
    }
    entries.push({ folders: parts, name, data });
  }
  return { entries, skipped };
}
