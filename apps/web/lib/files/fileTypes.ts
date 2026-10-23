/**
 * File types users can upload. The content type is always derived from the
 * extension (browsers report types inconsistently), and must match the list
 * in firebase/storage.rules.
 */
export type FileKind = "pdf" | "doc" | "sheet" | "slides" | "text" | "image" | "data";

type TypeInfo = { contentType: string; kind: FileKind };

const TYPES: Record<string, TypeInfo> = {
  pdf: { contentType: "application/pdf", kind: "pdf" },
  doc: { contentType: "application/msword", kind: "doc" },
  docx: { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", kind: "doc" },
  rtf: { contentType: "application/rtf", kind: "doc" },
  xls: { contentType: "application/vnd.ms-excel", kind: "sheet" },
  xlsx: { contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", kind: "sheet" },
  csv: { contentType: "text/csv", kind: "sheet" },
  ppt: { contentType: "application/vnd.ms-powerpoint", kind: "slides" },
  pptx: { contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", kind: "slides" },
  txt: { contentType: "text/plain", kind: "text" },
  md: { contentType: "text/markdown", kind: "text" },
  json: { contentType: "application/json", kind: "data" },
  png: { contentType: "image/png", kind: "image" },
  jpg: { contentType: "image/jpeg", kind: "image" },
  jpeg: { contentType: "image/jpeg", kind: "image" },
  webp: { contentType: "image/webp", kind: "image" },
  gif: { contentType: "image/gif", kind: "image" },
};

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export function typeInfo(name: string): TypeInfo | null {
  return TYPES[extensionOf(name)] ?? null;
}

export function isZip(name: string): boolean {
  return extensionOf(name) === "zip";
}

/** For the file picker's accept attribute */
export const ACCEPT = [...Object.keys(TYPES), "zip"].map((e) => "." + e).join(",");

export const SUPPORTED_LABEL = "PDF, Word, Excel, PowerPoint, CSV, text, images or ZIP";
