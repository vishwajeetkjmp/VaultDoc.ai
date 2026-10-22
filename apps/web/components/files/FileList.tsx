"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatBytes, formatDate } from "../../lib/files/format";
import type { Item } from "../../lib/files/items";
import FileIcon from "./FileIcon";
import styles from "./files.module.css";
import { ArrowDownIcon, ArrowUpIcon, FolderIcon, MoreIcon, SearchIcon } from "./icons";

export type SortKey = "name" | "modified" | "size";
type Sort = { key: SortKey; dir: 1 | -1 };

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

function sortItems(items: Item[], { key, dir }: Sort) {
  return items.slice().sort((a, b) => {
    // Folders always first, like Drive
    if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
    let cmp = 0;
    if (key === "size") cmp = a.size - b.size;
    else if (key === "modified") cmp = (a.updatedAt ?? a.createdAt)!.getTime() - (b.updatedAt ?? b.createdAt)!.getTime();
    if (cmp === 0) cmp = collator.compare(a.name, b.name);
    return cmp * dir;
  });
}

type Props = {
  items: Item[];
  pendingIds: Set<string>;
  loading: boolean;
  searching: boolean;
  onOpen: (item: Item) => void;
  onMenu: (item: Item, x: number, y: number) => void;
  onDelete: (item: Item) => void;
  onRename: (item: Item) => void;
  emptyState: React.ReactNode;
};

export default function FileList({ items, pendingIds, loading, searching, onOpen, onMenu, onDelete, onRename, emptyState }: Props) {
  const [sort, setSort] = useState<Sort>({ key: "name", dir: 1 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  const sorted = useMemo(() => sortItems(items, sort), [items, sort]);
  const selected = sorted.find((i) => i.id === selectedId) ?? null;

  // Keep the selection valid when the folder changes
  useEffect(() => {
    if (selectedId && !items.some((i) => i.id === selectedId)) setSelectedId(null);
  }, [items, selectedId]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "name" ? 1 : -1 }));

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!sorted.length) return;
    const index = selected ? sorted.indexOf(selected) : -1;
    const move = (to: number) => {
      const next = sorted[Math.max(0, Math.min(sorted.length - 1, to))];
      setSelectedId(next.id);
      wrap.current?.querySelector(`[data-id="${next.id}"]`)?.scrollIntoView({ block: "nearest" });
    };
    if (e.key === "ArrowDown") move(index + 1);
    else if (e.key === "ArrowUp") move(index < 0 ? 0 : index - 1);
    else if (e.key === "Home") move(0);
    else if (e.key === "End") move(sorted.length - 1);
    else if (selected && e.key === "Enter") onOpen(selected);
    else if (selected && (e.key === "Delete" || e.key === "Backspace")) onDelete(selected);
    else if (selected && e.key === "F2") onRename(selected);
    else return;
    e.preventDefault();
  };

  const handleSelect = useCallback((id: string) => setSelectedId(id), []);

  return (
    <div
      ref={wrap}
      className={styles.listWrap}
      tabIndex={0}
      role="grid"
      aria-label="Files"
      aria-rowcount={sorted.length}
      onKeyDown={onKeyDown}
      onMouseDown={(e) => e.target === e.currentTarget && setSelectedId(null)}
    >
      <div className={styles.headerRow} role="row">
        <SortHeader label="Name" k="name" sort={sort} onSort={toggleSort} />
        <span className={styles.modifiedCol}>
          <SortHeader label="Modified" k="modified" sort={sort} onSort={toggleSort} />
        </span>
        <SortHeader label="Size" k="size" sort={sort} onSort={toggleSort} />
        <span />
      </div>

      {loading && !items.length ? (
        <SkeletonRows />
      ) : !sorted.length ? (
        searching ? (
          <div className={styles.empty}>
            <div className={styles.emptyArt}>
              <SearchIcon size={36} />
            </div>
            <div className={styles.emptyTitle}>No matches in this folder</div>
            <div>Try a different name.</div>
          </div>
        ) : (
          emptyState
        )
      ) : (
        sorted.map((item) => (
          <Row
            key={item.id}
            item={item}
            pending={item.status !== "ready" && pendingIds.has(item.id)}
            selected={item.id === selectedId}
            onSelect={handleSelect}
            onOpen={onOpen}
            onMenu={onMenu}
          />
        ))
      )}
    </div>
  );
}

function SortHeader({ label, k, sort, onSort }: { label: string; k: SortKey; sort: Sort; onSort: (k: SortKey) => void }) {
  const active = sort.key === k;
  return (
    <button
      className={styles.sortButton}
      onClick={() => onSort(k)}
      style={active ? { color: "var(--text)" } : undefined}
      aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
    >
      {label}
      {active && (sort.dir === 1 ? <ArrowUpIcon size={14} /> : <ArrowDownIcon size={14} />)}
    </button>
  );
}

const Row = memo(function Row({
  item,
  pending,
  selected,
  onSelect,
  onOpen,
  onMenu,
}: {
  item: Item;
  pending: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  onOpen: (item: Item) => void;
  onMenu: (item: Item, x: number, y: number) => void;
}) {
  const folder = item.kind === "folder";
  const date = item.updatedAt ?? item.createdAt;
  return (
    <div
      data-id={item.id}
      role="row"
      aria-selected={selected}
      className={`${styles.row} ${selected ? styles.rowSelected : ""} ${pending ? styles.rowPending : ""}`}
      onMouseDown={() => onSelect(item.id)}
      onDoubleClick={() => !pending && onOpen(item)}
      onContextMenu={(e) => {
        e.preventDefault();
        onSelect(item.id);
        onMenu(item, e.clientX, e.clientY);
      }}
    >
      <div className={styles.nameCell}>
        <FileIcon name={item.name} folder={folder} />
        <span className={styles.nameText} title={item.name}>
          {item.name}
        </span>
      </div>
      <div className={`${styles.metaCell} ${styles.modifiedCol}`}>{pending ? "Uploading…" : formatDate(date)}</div>
      <div className={styles.metaCell}>{folder ? "—" : formatBytes(item.size)}</div>
      <button
        className={`${styles.iconButton} ${styles.rowActions}`}
        aria-label={`Actions for ${item.name}`}
        aria-haspopup="menu"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          onSelect(item.id);
          const r = e.currentTarget.getBoundingClientRect();
          onMenu(item, r.right - 220, r.bottom + 4);
        }}
      >
        <MoreIcon />
      </button>
    </div>
  );
});

function SkeletonRows() {
  return (
    <div aria-busy="true" aria-label="Loading">
      {[62, 48, 70, 40, 55, 66].map((w, i) => (
        <div key={i} className={styles.row} style={{ cursor: "default" }}>
          <div className={styles.nameCell}>
            <span className={`${styles.fileIcon} ${styles.skeleton}`} style={{ height: 32 }} />
            <span className={styles.skeleton} style={{ width: `${w}%` }} />
          </div>
          <span className={`${styles.skeleton} ${styles.modifiedCol}`} style={{ width: 70 }} />
          <span className={styles.skeleton} style={{ width: 50 }} />
          <span />
        </div>
      ))}
    </div>
  );
}

export function EmptyFolder({ isRoot, onUpload }: { isRoot: boolean; onUpload: () => void }) {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyArt}>
        <FolderIcon size={40} />
      </div>
      <div className={styles.emptyTitle}>{isRoot ? "Your vault is empty" : "This folder is empty"}</div>
      <div>Drop files here, or</div>
      <button className={styles.primaryButton} onClick={onUpload} style={{ marginTop: 6 }}>
        Upload files
      </button>
    </div>
  );
}
