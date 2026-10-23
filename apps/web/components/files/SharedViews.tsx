"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { callError } from "../../lib/callable";
import { formatDate } from "../../lib/files/format";
import { listSharedWithMe, MyShare, revokeShare, SharedWithMe, shareUrl } from "../../lib/files/shares";
import FileIcon from "./FileIcon";
import files from "./files.module.css";
import { DownloadIcon, EyeIcon, InboxIcon, LinkIcon, MoreIcon, PeopleIcon, ShareIcon, TrashIcon, PencilIcon } from "./icons";
import { Menu, MenuAction } from "./Popups";
import styles from "./share.module.css";

const shortDate = (d: Date) => d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });

function ExpiryPill({ at }: { at: Date | null }) {
  if (!at) return <span className={styles.muted}>Never expires</span>;
  if (at.getTime() < Date.now()) return <span className={styles.pillWarn}>Expired</span>;
  const days = Math.ceil((at.getTime() - Date.now()) / 86_400_000);
  return <span className={days <= 2 ? styles.pillWarn : styles.pill}>{days <= 1 ? "Expires today" : `Until ${shortDate(at)}`}</span>;
}

function Empty({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className={files.empty}>
      <div className={files.emptyArt}>{icon}</div>
      <div className={files.emptyTitle}>{title}</div>
      <div style={{ maxWidth: 360, textAlign: "center" }}>{text}</div>
    </div>
  );
}

/** Everything the user has shared, with access, expiry and how often it was opened. */
export function SharedByMe({
  shares,
  loading,
  onEdit,
  onToast,
}: {
  shares: MyShare[];
  loading: boolean;
  onEdit: (share: MyShare) => void;
  onToast: (message: string) => void;
}) {
  const [menu, setMenu] = useState<{ x: number; y: number; actions: MenuAction[] } | null>(null);

  if (loading && !shares.length) return <div className={files.empty} aria-busy="true" />;
  if (!shares.length) {
    return (
      <Empty
        icon={<ShareIcon size={38} />}
        title="Nothing shared yet"
        text="Right-click a file or folder in My Space and choose Share to send it by link or email."
      />
    );
  }

  const showMenu = (s: MyShare, x: number, y: number) =>
    setMenu({
      x,
      y,
      actions: [
        {
          label: "Copy link",
          icon: <LinkIcon size={18} />,
          onSelect: () => navigator.clipboard.writeText(shareUrl(s.linkId)).then(() => onToast("Link copied")),
        },
        { label: "Edit sharing", icon: <PencilIcon size={18} />, onSelect: () => onEdit(s) },
        "divider",
        {
          label: "Stop sharing",
          icon: <TrashIcon size={18} />,
          danger: true,
          onSelect: () =>
            revokeShare(s.linkId)
              .then(() => onToast(`Stopped sharing “${s.itemName}”`))
              .catch((e) => onToast(callError(e).message)),
        },
      ],
    });

  return (
    <div className={styles.list} role="table" aria-label="Shared by me">
      <div className={styles.listHeader} role="row">
        <span>Name</span>
        <span className={styles.hideNarrow}>Access</span>
        <span className={styles.hideNarrow}>Activity</span>
        <span className={styles.hideNarrow}>Expiry</span>
        <span />
      </div>
      {shares.map((s) => (
        <div key={s.linkId} className={styles.listRow} role="row" onDoubleClick={() => onEdit(s)} onContextMenu={(e) => (e.preventDefault(), showMenu(s, e.clientX, e.clientY))}>
          <div className={styles.cellMain}>
            <FileIcon name={s.itemName} folder={s.itemKind === "folder"} />
            <div className={styles.cellName}>
              <div title={s.itemName}>{s.itemName}</div>
              <div className={styles.muted}>Shared {s.createdAt ? formatDate(s.createdAt) : "just now"}</div>
            </div>
          </div>
          <span className={styles.hideNarrow}>
            <span className={styles.pill}>
              <PeopleIcon size={14} />
              {s.mode === "link" ? "Anyone with link" : `${s.invitees.length} ${s.invitees.length === 1 ? "person" : "people"}`}
            </span>
          </span>
          <span className={`${styles.stats} ${styles.hideNarrow}`}>
            <span title="Views">
              <EyeIcon size={14} />
              {s.views}
            </span>
            <span title="Downloads">
              <DownloadIcon size={14} />
              {s.downloads}
            </span>
          </span>
          <span className={styles.hideNarrow}>
            <ExpiryPill at={s.expiresAt} />
          </span>
          <button
            className={files.iconButton}
            aria-label={`Actions for ${s.itemName}`}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              showMenu(s, r.right - 220, r.bottom + 4);
            }}
          >
            <MoreIcon />
          </button>
        </div>
      ))}
      {menu && <Menu {...menu} onClose={() => setMenu(null)} />}
    </div>
  );
}

/** Items other people invited this user to. Opens on the share page. */
export function SharedWithMeList({ onToast }: { onToast: (message: string) => void }) {
  const [shares, setShares] = useState<SharedWithMe[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    listSharedWithMe()
      .then((list) => !cancelled && setShares(list))
      .catch((e) => {
        if (cancelled) return;
        setShares([]);
        onToast(callError(e).message);
      });
    return () => {
      cancelled = true;
    };
  }, [onToast]);

  if (!shares) return <div className={files.empty} aria-busy="true" />;
  if (!shares.length) {
    return <Empty icon={<InboxIcon size={38} />} title="Nothing shared with you yet" text="When someone shares a file or folder with your email, it appears here." />;
  }

  return (
    <div className={styles.list} role="table" aria-label="Shared with me">
      <div className={`${styles.listHeader} ${styles.cols4}`} role="row">
        <span>Name</span>
        <span className={styles.hideNarrow}>Shared by</span>
        <span className={styles.hideNarrow}>Date</span>
        <span className={styles.hideNarrow}>Expiry</span>
      </div>
      {shares.map((s) => (
        <Link
          key={s.linkId}
          href={`/s/${s.linkId}`}
          className={`${styles.listRow} ${styles.cols4}`}
          role="row"
          style={{ color: "inherit" }}
        >
          <div className={styles.cellMain}>
            <FileIcon name={s.itemName} folder={s.itemKind === "folder"} />
            <div className={styles.cellName}>
              <div title={s.itemName}>{s.itemName}</div>
            </div>
          </div>
          <div className={`${styles.cellName} ${styles.hideNarrow}`}>
            <div>{s.ownerName}</div>
            <div className={styles.muted}>{s.ownerEmail}</div>
          </div>
          <span className={`${styles.muted} ${styles.hideNarrow}`}>{s.sharedAt ? shortDate(new Date(s.sharedAt)) : ""}</span>
          <span className={styles.hideNarrow}>
            <ExpiryPill at={s.expiresAt ? new Date(s.expiresAt) : null} />
          </span>
        </Link>
      ))}
    </div>
  );
}
