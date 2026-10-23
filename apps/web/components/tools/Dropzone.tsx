"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./tools.module.css";

/**
 * Click, drag-and-drop, or paste (Ctrl/⌘+V) files. `compact` is the slim
 * "add more" version shown once files are loaded.
 */
export default function Dropzone({
  accept,
  acceptLabel,
  multiple,
  onFiles,
  compact,
}: {
  accept: string;
  acceptLabel: string;
  multiple: boolean;
  onFiles: (files: File[]) => void;
  compact?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const depth = useRef(0);

  // Paste images or files from the clipboard anywhere on the page
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length) onFiles(multiple ? files : files.slice(0, 1));
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [onFiles, multiple]);

  const className = compact ? styles.dropCompact : over ? styles.dropActive : styles.drop;

  return (
    <div
      className={className}
      role="button"
      tabIndex={0}
      aria-label={`Choose ${acceptLabel} files`}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
      onDragEnter={(e) => {
        e.preventDefault();
        depth.current++;
        setOver(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => {
        if (--depth.current <= 0) {
          depth.current = 0;
          setOver(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        depth.current = 0;
        setOver(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length) onFiles(multiple ? files : files.slice(0, 1));
      }}
    >
      {compact ? (
        <span>
          <b>+ Add {multiple ? "more files" : "a different file"}</b> <span className={styles.dropHint}>or drop here</span>
        </span>
      ) : (
        <>
          <span className={styles.dropIcon} aria-hidden>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 15V4M7 9l5-5 5 5" />
              <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
            </svg>
          </span>
          <span className={styles.dropTitle}>{multiple ? "Choose files" : "Choose a file"} or drop {multiple ? "them" : "it"} here</span>
          <span className={styles.dropHint}>
            {acceptLabel} · You can also paste with Ctrl/⌘ + V
          </span>
        </>
      )}
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
