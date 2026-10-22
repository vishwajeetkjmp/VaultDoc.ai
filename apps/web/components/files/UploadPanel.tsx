"use client";

import { memo, useState } from "react";
import { formatBytes } from "../../lib/files/format";
import { Upload, uploadQueue, useUploads } from "../../lib/files/uploader";
import FileIcon from "./FileIcon";
import styles from "./files.module.css";
import { AlertIcon, CheckIcon, ChevronDownIcon, ChevronUpIcon, CloseIcon, SkipIcon } from "./icons";

const ACTIVE = new Set(["queued", "checking", "uploading"]);

/** Collapsible upload tray in the bottom-right corner, like Google Drive's. */
export default function UploadPanel() {
  const uploads = useUploads();
  const [collapsed, setCollapsed] = useState(false);
  if (!uploads.length) return null;

  const active = uploads.filter((u) => ACTIVE.has(u.state) && !u.isZip);
  const files = uploads.filter((u) => !u.isZip);
  const done = files.filter((u) => u.state === "done").length;
  const problems = uploads.filter((u) => u.state === "failed").length;

  // Overall progress by bytes across files still in this batch
  const total = active.reduce((s, u) => s + u.size, 0);
  const sent = active.reduce((s, u) => s + u.size * u.progress, 0);

  let title: string;
  if (active.length) title = `Uploading ${active.length} item${active.length === 1 ? "" : "s"}`;
  else if (problems && !done) title = `${problems} upload${problems === 1 ? "" : "s"} failed`;
  else title = `${done} upload${done === 1 ? "" : "s"} complete${problems ? ` · ${problems} failed` : ""}`;

  return (
    <section className={styles.uploadPanel} aria-label="Uploads">
      <div className={styles.uploadHeader}>
        <span className={styles.uploadTitle} aria-live="polite">
          {title}
        </span>
        <button
          className={styles.iconButton}
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand uploads" : "Collapse uploads"}
        >
          {collapsed ? <ChevronUpIcon /> : <ChevronDownIcon />}
        </button>
        <button
          className={styles.iconButton}
          onClick={() => (active.length ? uploadQueue.cancelAll() : uploadQueue.clearFinished())}
          aria-label={active.length ? "Cancel all uploads" : "Close"}
          title={active.length ? "Cancel all" : "Close"}
        >
          <CloseIcon />
        </button>
      </div>
      {active.length > 0 && (
        <div className={styles.uploadOverall}>
          <div className={styles.uploadOverallBar} style={{ width: `${total ? (sent / total) * 100 : 0}%` }} />
        </div>
      )}
      {!collapsed && (
        <div className={styles.uploadList}>
          {/* Newest first */}
          {uploads
            .slice()
            .reverse()
            .map((u) => (
              <UploadRow key={u.key} upload={u} />
            ))}
        </div>
      )}
    </section>
  );
}

const UploadRow = memo(function UploadRow({ upload: u }: { upload: Upload }) {
  const active = ACTIVE.has(u.state);
  let meta: string;
  switch (u.state) {
    case "queued":
      meta = `${formatBytes(u.size)} · Waiting…`;
      break;
    case "checking":
      meta = u.message ?? `${formatBytes(u.size)} · Preparing…`;
      break;
    case "uploading":
      meta = `${formatBytes(u.size * u.progress)} of ${formatBytes(u.size)}`;
      break;
    case "done":
      meta = u.message ?? formatBytes(u.size);
      break;
    case "cancelled":
      meta = "Cancelled";
      break;
    default:
      meta = u.message ?? "";
  }

  return (
    <div className={styles.uploadRow}>
      <FileIcon name={u.name} />
      <div style={{ minWidth: 0 }}>
        <div className={styles.uploadName} title={u.name}>
          {u.name}
        </div>
        <div className={u.state === "failed" ? styles.uploadMetaError : styles.uploadMeta} title={meta}>
          {meta}
        </div>
        {u.state === "uploading" && (
          <div className={styles.uploadBar}>
            <div className={styles.uploadBarFill} style={{ width: `${u.progress * 100}%` }} />
          </div>
        )}
      </div>
      <div>
        {active && !u.isZip ? (
          <>
            <span className={`${styles.statusIcon} ${styles.hideOnHover}`}>
              <Spinner progress={u.state === "uploading" ? u.progress : null} />
            </span>
            <button
              className={`${styles.iconButton} ${styles.cancelOnHover}`}
              onClick={() => uploadQueue.cancel(u.key)}
              aria-label={`Cancel ${u.name}`}
              title="Cancel"
            >
              <CloseIcon size={18} />
            </button>
          </>
        ) : (
          <span className={styles.statusIcon}>
            {active && <Spinner progress={null} />}
            {u.state === "done" && <CheckIcon size={20} style={{ color: "#30a46c" }} />}
            {u.state === "failed" && <AlertIcon size={20} style={{ color: "#e5484d" }} />}
            {(u.state === "skipped" || u.state === "cancelled") && (
              <SkipIcon size={20} style={{ color: "var(--text-muted)" }} />
            )}
          </span>
        )}
      </div>
    </div>
  );
});

/** Ring that fills with progress, or spins while there's no progress yet */
function Spinner({ progress }: { progress: number | null }) {
  const r = 9;
  const c = 2 * Math.PI * r;
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" style={progress === null ? { animation: "spin 0.9s linear infinite" } : undefined}>
      <circle cx="11" cy="11" r={r} fill="none" stroke="var(--border)" strokeWidth="2.5" />
      <circle
        cx="11"
        cy="11"
        r={r}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={progress === null ? c * 0.7 : c * (1 - progress)}
        transform="rotate(-90 11 11)"
        style={{ transition: "stroke-dashoffset 0.2s linear" }}
      />
    </svg>
  );
}
