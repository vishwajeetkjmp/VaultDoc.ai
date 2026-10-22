import { extensionOf, typeInfo, type FileKind } from "../../lib/files/fileTypes";
import styles from "./files.module.css";
import { FolderIcon } from "./icons";

const KIND_COLORS: Record<FileKind | "zip" | "other", string> = {
  pdf: "#e5484d",
  doc: "#3b82f6",
  sheet: "#22a06b",
  slides: "#f97316",
  text: "#64748b",
  image: "#a855f7",
  data: "#0ea5e9",
  zip: "#a16207",
  other: "#64748b",
};

/** Coloured badge with the file's extension, like "PDF" or "XLSX". Folders get a folder glyph. */
export default function FileIcon({ name, folder }: { name: string; folder?: boolean }) {
  if (folder) {
    return (
      <span className={styles.fileIcon} style={{ background: "color-mix(in srgb, var(--primary) 22%, transparent)", color: "var(--primary)" }}>
        <FolderIcon size={18} fill="currentColor" fillOpacity={0.25} />
      </span>
    );
  }
  const ext = extensionOf(name);
  const kind = ext === "zip" ? "zip" : typeInfo(name)?.kind ?? "other";
  return (
    <span className={styles.fileIcon} style={{ background: KIND_COLORS[kind] }}>
      {(ext || "FILE").slice(0, 4).toUpperCase()}
    </span>
  );
}
