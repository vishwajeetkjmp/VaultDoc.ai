"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { signOutUser } from "../../lib/auth";
import { callError } from "../../lib/callable";
import { formatBytes } from "../../lib/files/format";
import { OpenedShare, openShare, SharedItem, sharedFileBlobOrUrl, sharedFileBytes } from "../../lib/files/shares";
import { withNext } from "../../lib/nav";
import { useAuth } from "../AuthProvider";
import FileIcon from "../files/FileIcon";
import files from "../files/files.module.css";
import { ChevronRightIcon, ClockIcon, DownloadIcon, EyeIcon, LinkIcon, LockIcon, ZipIcon } from "../files/icons";
import styles from "../files/share.module.css";

const PREVIEWABLE = /^(application\/pdf|image\/(png|jpeg|webp|gif)|text\/plain)$/;

type Failure = { reason?: string; message: string; email?: string };

/** What someone sees when they open a shared link: the file or folder, with preview and download. */
export default function SharePage({ linkId }: { linkId: string }) {
  const { user, loading: authLoading } = useAuth();
  const [share, setShare] = useState<OpenedShare | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // item id being fetched, or "zip"
  const [zipPercent, setZipPercent] = useState(0);
  const [notice, setNotice] = useState("");

  // (Re)load whenever the login changes: an invited person may log in or switch accounts
  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    setShare(null);
    setFailure(null);
    openShare(linkId)
      .then((s) => {
        if (cancelled) return;
        setShare(s);
        setFolderId(s.root.id);
      })
      .catch((e) => {
        if (cancelled) return;
        const err = callError(e);
        setFailure({ reason: err.reason, message: err.message, email: typeof err.details?.email === "string" ? err.details.email : undefined });
      });
    return () => {
      cancelled = true;
    };
  }, [linkId, authLoading, user?.uid]);

  const fail = useCallback((e: unknown) => {
    const err = callError(e);
    if (err.reason) setFailure({ reason: err.reason, message: err.message });
    else setNotice(err.message);
  }, []);

  const save = (url: string, name?: string) => {
    const a = document.createElement("a");
    a.href = url;
    if (name) a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const download = async (item: SharedItem) => {
    setBusy(item.id);
    setNotice("");
    try {
      const r = await sharedFileBlobOrUrl(linkId, item.id, { download: true, count: true });
      if (r.blob) {
        const url = URL.createObjectURL(r.blob);
        save(url, item.name);
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else save(r.url!);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const preview = async (item: SharedItem) => {
    const tab = window.open("", "_blank"); // must open during the click, or popup blockers stop it
    setBusy(item.id);
    try {
      const r = await sharedFileBlobOrUrl(linkId, item.id, { download: false });
      const url = r.blob ? URL.createObjectURL(r.blob) : r.url!;
      if (tab) tab.location.href = url;
      else window.location.href = url;
    } catch (e) {
      tab?.close();
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const downloadAll = async () => {
    if (!share) return;
    setBusy("zip");
    setZipPercent(0);
    setNotice("");
    try {
      const { downloadZip, zipPaths } = await import("../../lib/files/zipDownload");
      // The whole share counts as one download
      const entries = zipPaths(share.root.id, share.items).map(({ item, path }, i) => ({
        path,
        size: item.size,
        load: () => sharedFileBytes(linkId, item.id, i === 0),
      }));
      if (!entries.length) {
        setNotice("This folder has no files yet.");
        return;
      }
      await downloadZip(share.root.name, entries, (done, total) => setZipPercent(total ? Math.round((done / total) * 100) : 100));
    } catch (e) {
      if (e instanceof Error && e.message.includes("too big")) setNotice(e.message);
      else fail(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.pageBar}>
        <Link href="/" className={styles.brand}>
          <span aria-hidden>🔒</span> VaultDocAI
        </Link>
        {!authLoading &&
          (user ? (
            <Link href="/dashboard" className={files.button} style={{ display: "inline-flex", alignItems: "center" }}>
              My Space
            </Link>
          ) : (
            <Link href={withNext("/login", `/s/${linkId}`)} className={files.button} style={{ display: "inline-flex", alignItems: "center" }}>
              Login
            </Link>
          ))}
      </header>

      <main className={styles.pageMain}>
        {failure ? (
          <FailureCard failure={failure} linkId={linkId} />
        ) : !share ? (
          <Skeleton />
        ) : share.root.kind === "file" ? (
          <FileCard share={share} busy={busy === share.root.id} onDownload={() => download(share.root)} onPreview={() => preview(share.root)} />
        ) : (
          <FolderCard
            share={share}
            folderId={folderId ?? share.root.id}
            onFolder={setFolderId}
            busy={busy}
            zipPercent={zipPercent}
            onDownload={download}
            onPreview={preview}
            onDownloadAll={downloadAll}
          />
        )}
        {notice && (
          <div className={styles.error} role="alert" style={{ marginTop: 16 }}>
            {notice}
          </div>
        )}
        <p className={styles.promo}>
          Shared securely with VaultDocAI. <Link href="/signup">Keep your own documents safe, free →</Link>
        </p>
      </main>
    </div>
  );
}

function ShareMeta({ share }: { share: OpenedShare }) {
  return (
    <div className={styles.stats} style={{ marginTop: 6 }}>
      <span>Shared by {share.ownerName}</span>
      {share.mode === "invite" && (
        <span>
          <LockIcon size={14} /> Only invited people
        </span>
      )}
      {share.expiresAt && (
        <span>
          <ClockIcon size={14} /> Until {new Date(share.expiresAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
        </span>
      )}
      {share.isOwner && <span className={styles.pill}>You're the owner: your visits aren't counted</span>}
    </div>
  );
}

function FileCard({ share, busy, onDownload, onPreview }: { share: OpenedShare; busy: boolean; onDownload: () => void; onPreview: () => void }) {
  const f = share.root;
  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <span className={styles.bigIcon}>
          <FileIcon name={f.name} />
        </span>
        <div className={styles.headText}>
          <div className={styles.title}>{f.name}</div>
          <div className={styles.muted}>{formatBytes(f.size)}</div>
          <ShareMeta share={share} />
        </div>
        <div className={styles.actions}>
          {f.contentType && PREVIEWABLE.test(f.contentType) && (
            <button className={files.button} onClick={onPreview} disabled={busy} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <EyeIcon size={16} /> Preview
            </button>
          )}
          <button className={files.primaryButton} onClick={onDownload} disabled={busy} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <DownloadIcon size={16} /> {busy ? "Preparing…" : "Download"}
          </button>
        </div>
      </div>
    </section>
  );
}

function FolderCard({
  share,
  folderId,
  onFolder,
  busy,
  zipPercent,
  onDownload,
  onPreview,
  onDownloadAll,
}: {
  share: OpenedShare;
  folderId: string;
  onFolder: (id: string) => void;
  busy: string | null;
  zipPercent: number;
  onDownload: (item: SharedItem) => void;
  onPreview: (item: SharedItem) => void;
  onDownloadAll: () => void;
}) {
  const byId = useMemo(() => new Map(share.items.map((i) => [i.id, i])), [share.items]);
  const fileCount = share.items.filter((i) => i.kind === "file").length;
  const totalBytes = share.items.reduce((s, i) => s + (i.kind === "file" ? i.size : 0), 0);

  const children = useMemo(
    () =>
      share.items
        .filter((i) => i.parentId === folderId)
        .sort((a, b) => (a.kind !== b.kind ? (a.kind === "folder" ? -1 : 1) : a.name.localeCompare(b.name, undefined, { numeric: true }))),
    [share.items, folderId],
  );

  // Breadcrumbs from the shared folder down to the one being viewed
  const trail: SharedItem[] = [];
  for (let at = byId.get(folderId); at; at = byId.get(at.parentId)) trail.unshift(at);

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <span className={styles.bigIcon}>
          <FileIcon name={share.root.name} folder />
        </span>
        <div className={styles.headText}>
          <div className={styles.title}>{share.root.name}</div>
          <div className={styles.muted}>
            {fileCount} {fileCount === 1 ? "file" : "files"} · {formatBytes(totalBytes)}
          </div>
          <ShareMeta share={share} />
        </div>
        <div className={styles.actions}>
          <button className={files.primaryButton} onClick={onDownloadAll} disabled={busy === "zip" || !fileCount} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ZipIcon size={16} /> {busy === "zip" ? `Zipping… ${zipPercent}%` : "Download all"}
          </button>
        </div>
      </div>
      {busy === "zip" && (
        <div className={styles.progress} role="progressbar" aria-valuenow={zipPercent} aria-valuemin={0} aria-valuemax={100}>
          <div className={styles.progressBar} style={{ width: `${zipPercent}%` }} />
        </div>
      )}
      {share.truncated && <div className={styles.note} style={{ margin: "0 20px 12px" }}>This folder is very large; only the first 2,000 items are shown.</div>}

      {trail.length > 0 && (
        <nav className={styles.crumbs} aria-label="Folder path">
          <button onClick={() => onFolder(share.root.id)}>{share.root.name}</button>
          {trail.map((f, i) => (
            <span key={f.id} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <ChevronRightIcon size={16} style={{ color: "var(--text-muted)" }} />
              {i === trail.length - 1 ? <span style={{ padding: "4px 6px" }}>{f.name}</span> : <button onClick={() => onFolder(f.id)}>{f.name}</button>}
            </span>
          ))}
        </nav>
      )}

      {!children.length ? (
        <div className={styles.state}>
          <span className={styles.muted}>This folder is empty.</span>
        </div>
      ) : (
        children.map((item) => (
          <div key={item.id} className={styles.fileRow}>
            <FileIcon name={item.name} folder={item.kind === "folder"} />
            {item.kind === "folder" ? (
              <button className={styles.fileRowName} onClick={() => onFolder(item.id)} title={item.name}>
                {item.name}
              </button>
            ) : (
              <span className={styles.fileRowName} title={item.name}>
                {item.name}
              </span>
            )}
            {item.kind === "file" && (
              <>
                <span className={`${styles.muted} ${styles.hideNarrow}`}>{formatBytes(item.size)}</span>
                {item.contentType && PREVIEWABLE.test(item.contentType) && (
                  <button className={files.iconButton} onClick={() => onPreview(item)} disabled={!!busy} aria-label={`Preview ${item.name}`} title="Preview">
                    <EyeIcon size={18} />
                  </button>
                )}
                <button className={files.iconButton} onClick={() => onDownload(item)} disabled={!!busy} aria-label={`Download ${item.name}`} title="Download">
                  {busy === item.id ? <span className={styles.muted}>…</span> : <DownloadIcon size={18} />}
                </button>
              </>
            )}
          </div>
        ))
      )}
    </section>
  );
}

function FailureCard({ failure, linkId }: { failure: Failure; linkId: string }) {
  const here = `/s/${linkId}`;
  const content: Record<string, { icon: React.ReactNode; title: string; text: string; actions?: React.ReactNode }> = {
    gone: { icon: <LinkIcon size={28} />, title: "This link isn't active", text: "The owner stopped sharing it, or the link is incomplete. Ask them for a new one." },
    expired: { icon: <ClockIcon size={28} />, title: "This link has expired", text: "Ask the person who shared it to send a new link." },
    deleted: { icon: <LinkIcon size={28} />, title: "This item was deleted", text: "The owner deleted it, so it can't be opened anymore." },
    login: {
      icon: <LockIcon size={28} />,
      title: "This was shared privately",
      text: "Log in with the email address it was sent to.",
      actions: (
        <div className={styles.actions} style={{ justifyContent: "center", marginTop: 6 }}>
          <Link href={withNext("/login", here)} className={files.primaryButton} style={{ display: "inline-flex", alignItems: "center" }}>
            Login
          </Link>
          <Link href={withNext("/signup", here)} className={files.button} style={{ display: "inline-flex", alignItems: "center" }}>
            Create free account
          </Link>
        </div>
      ),
    },
    verify: {
      icon: <LockIcon size={28} />,
      title: "Verify your email first",
      text: "Open the verification link we emailed you, then come back to this page.",
      actions: (
        <Link href="/dashboard" className={files.primaryButton} style={{ display: "inline-flex", alignItems: "center", marginTop: 6 }}>
          Verify email
        </Link>
      ),
    },
    "wrong-account": {
      icon: <LockIcon size={28} />,
      title: "Shared with a different email",
      text: `You're logged in as ${failure.email ?? "another account"}, but this was shared with someone else. Log in with the invited email.`,
      actions: (
        <button className={files.primaryButton} style={{ marginTop: 6 }} onClick={() => signOutUser().then(() => (window.location.href = withNext("/login", here)))}>
          Switch account
        </button>
      ),
    },
  };
  const c = content[failure.reason ?? ""] ?? { icon: <LinkIcon size={28} />, title: "Couldn't open this link", text: failure.message };
  return (
    <section className={styles.card}>
      <div className={styles.state}>
        <span className={styles.stateIcon}>{c.icon}</span>
        <div className={styles.title}>{c.title}</div>
        <div className={styles.muted} style={{ maxWidth: 420, fontSize: 15 }}>
          {c.text}
        </div>
        {c.actions}
      </div>
    </section>
  );
}

function Skeleton() {
  return (
    <section className={styles.card} aria-busy="true" aria-label="Loading">
      <div className={styles.cardHead}>
        <span className={styles.skeletonLine} style={{ width: 48, height: 48, borderRadius: 12 }} />
        <div className={styles.headText} style={{ display: "grid", gap: 10 }}>
          <span className={styles.skeletonLine} style={{ width: "60%" }} />
          <span className={styles.skeletonLine} style={{ width: "35%" }} />
        </div>
      </div>
      {[70, 52, 64].map((w) => (
        <div key={w} className={styles.fileRow}>
          <span className={styles.skeletonLine} style={{ width: `${w}%` }} />
        </div>
      ))}
    </section>
  );
}
