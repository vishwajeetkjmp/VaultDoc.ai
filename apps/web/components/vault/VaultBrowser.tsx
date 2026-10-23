"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "firebase/auth";
import ProfileMenu from "../ProfileMenu";
import FileList from "../files/FileList";
import FileIcon from "../files/FileIcon";
import { ConfirmDialog, Menu, MenuAction, NameDialog } from "../files/Popups";
import files from "../files/files.module.css";
import {
  AlertIcon,
  CheckIcon,
  ChevronRightIcon,
  CloseIcon,
  DownloadIcon,
  FolderIcon,
  FolderPlusIcon,
  OpenIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  UploadIcon,
} from "../files/icons";
import { ACCEPT, typeInfo } from "../../lib/files/fileTypes";
import { formatBytes } from "../../lib/files/format";
import { FolderRef, ROOT_FOLDER, ROOT_ID, uniqueName } from "../../lib/files/items";
import { useStorageAccount } from "../../lib/files/limits";
import {
  createVaultFolder,
  deleteVaultItems,
  listenVaultFolder,
  openVaultFile,
  renameVaultItem,
  uploadVaultFile,
  VaultItem,
} from "../../lib/vault/store";
import { useIdleLock } from "../../lib/vault/useIdleLock";
import styles from "./vault.module.css";

type Upload = { key: string; name: string; size: number; state: "working" | "done" | "failed"; progress: number; message?: string };
type DialogState = { type: "newFolder" } | { type: "rename"; item: VaultItem } | { type: "delete"; item: VaultItem } | null;

const NO_PENDING = new Set<string>();

/** The unlocked vault. Holds the vault key only in memory; `onLock` drops it. */
export default function VaultBrowser({ user, vaultKey, onLock }: { user: User; vaultKey: CryptoKey; onLock: () => void }) {
  const uid = user.uid;
  const secondsLeft = useIdleLock(onLock);
  const account = useStorageAccount(uid);

  const [chain, setChain] = useState<VaultItem[]>([]);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [menu, setMenu] = useState<{ x: number; y: number; actions: MenuAction[] } | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const current = chain[chain.length - 1];
  const folder: FolderRef = current ? { id: current.id, ancestorIds: current.ancestorIds } : ROOT_FOLDER;
  const folderId = current?.id ?? ROOT_ID;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    setLoading(true);
    setItems([]);
    return listenVaultFolder(
      uid,
      vaultKey,
      folderId,
      (list) => {
        setItems(list);
        setLoading(false);
      },
      () => {
        setLoading(false);
        setToast("Couldn't load this folder.");
      },
    );
  }, [uid, vaultKey, folderId]);

  const visible = useMemo(() => items.filter((i) => i.status === "ready"), [items]);

  const patchUpload = (key: string, changes: Partial<Upload>) =>
    setUploads((list) => list.map((u) => (u.key === key ? { ...u, ...changes } : u)));

  const upload = useCallback(
    async (picked: File[]) => {
      let reserved = 0;
      for (const file of picked) {
        const key = crypto.randomUUID();
        const base = { key, name: file.name, size: file.size, progress: 0 };
        const info = typeInfo(file.name);
        const free = account.quotaBytes - account.usedBytes - reserved;
        const problem = !info
          ? "Unsupported file type"
          : file.size === 0
            ? "File is empty"
            : file.size > account.limits.maxFileBytes
              ? `Too large (${formatBytes(file.size)}). Max ${formatBytes(account.limits.maxFileBytes)} per file`
              : file.size > free
                ? "Not enough storage left"
                : null;
        if (problem) {
          setUploads((list) => [...list, { ...base, state: "failed", message: problem }]);
          continue;
        }
        reserved += file.size;
        setUploads((list) => [...list, { ...base, state: "working", message: "Encrypting…" }]);
        try {
          await uploadVaultFile(uid, vaultKey, folder, { name: file.name, contentType: info!.contentType, data: file }, (p) =>
            patchUpload(key, { progress: p, message: undefined }),
          );
          patchUpload(key, { state: "done", progress: 1 });
        } catch {
          patchUpload(key, { state: "failed", message: "Upload failed" });
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uid, vaultKey, folder.id, account.usedBytes, account.quotaBytes, account.limits.maxFileBytes],
  );

  const open = useCallback(
    (item: VaultItem) => {
      if (item.kind === "folder") setChain((c) => [...c, item]);
      else openVaultFile(vaultKey, item, "open").catch(() => setToast(`Couldn't open “${item.name}”`));
    },
    [vaultKey],
  );

  const showItemMenu = useCallback(
    (item: VaultItem, x: number, y: number) => {
      const actions: MenuAction[] = [{ label: "Open", icon: <OpenIcon size={18} />, onSelect: () => open(item) }];
      if (item.kind === "file") {
        actions.push({
          label: "Download",
          icon: <DownloadIcon size={18} />,
          onSelect: () => openVaultFile(vaultKey, item, "download").catch(() => setToast(`Couldn't download “${item.name}”`)),
        });
      }
      actions.push(
        { label: "Rename", icon: <PencilIcon size={18} />, onSelect: () => setDialog({ type: "rename", item }) },
        "divider",
        { label: "Delete", icon: <TrashIcon size={18} />, danger: true, onSelect: () => setDialog({ type: "delete", item }) },
      );
      setMenu({ x, y, actions });
    },
    [open, vaultKey],
  );

  const showNewMenu = (e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setMenu({
      x: r.left,
      y: r.bottom + 6,
      actions: [
        { label: "New folder", icon: <FolderPlusIcon size={18} />, onSelect: () => setDialog({ type: "newFolder" }) },
        "divider",
        { label: "Upload files", icon: <UploadIcon size={18} />, onSelect: () => fileInput.current?.click() },
      ],
    });
  };

  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files");
  const dropHandlers = {
    onDragEnter: (e: React.DragEvent) => {
      if (!hasFiles(e)) return;
      dragDepth.current++;
      setDragging(true);
    },
    onDragOver: (e: React.DragEvent) => hasFiles(e) && e.preventDefault(),
    onDragLeave: () => {
      if (--dragDepth.current <= 0) {
        dragDepth.current = 0;
        setDragging(false);
      }
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      upload(Array.from(e.dataTransfer.files));
    },
  };

  const working = uploads.filter((u) => u.state === "working").length;

  return (
    <div className={files.app}>
      <header className={files.topbar}>
        <a href="/dashboard" className={files.brand}>
          <span className={files.brandMark}>🔐</span>
          <span className={files.brandName}>Secure Vault</span>
        </a>
        <div />
        <div className={files.topRight}>
          <span className={secondsLeft <= 10 ? styles.lockChipSoon : styles.lockChip} title="Locks automatically after 60 seconds without activity">
            {secondsLeft <= 10 ? `Locking in ${secondsLeft}s` : "Auto-lock on"}
          </span>
          <button className={files.button} onClick={onLock}>
            🔒 Lock
          </button>
          <ProfileMenu user={user} />
        </div>
      </header>

      <div className={files.body}>
        <aside className={files.sidebar}>
          <button className={files.newButton} onClick={showNewMenu} aria-haspopup="menu">
            <PlusIcon size={22} />
            New
          </button>
          <a href="/dashboard" className={files.navItem} style={{ background: "transparent" }}>
            <FolderIcon size={18} />
            My Files
          </a>
          <button className={files.navItem} onClick={() => setChain([])} style={{ border: 0, textAlign: "left" }}>
            🔐 Secure Vault
          </button>
          <div className={files.sidebarFooter}>
            <p className={files.meterText} style={{ lineHeight: 1.5 }}>
              🛡️ Files here are encrypted on your device. Only you can open them, not even the VaultDoc team.
            </p>
          </div>
        </aside>

        <main className={files.main} {...dropHandlers}>
          <div className={files.toolbar}>
            <nav className={files.crumbs} aria-label="Folder path">
              {chain.length === 0 ? (
                <span className={files.crumbCurrent}>Secure Vault</span>
              ) : (
                <>
                  <button className={files.crumb} onClick={() => setChain([])}>
                    Secure Vault
                  </button>
                  {chain.map((f, i) => (
                    <Fragment key={f.id}>
                      <ChevronRightIcon size={18} className={files.crumbSep} />
                      {i === chain.length - 1 ? (
                        <span className={files.crumbCurrent}>{f.name}</span>
                      ) : (
                        <button className={files.crumb} onClick={() => setChain((c) => c.slice(0, i + 1))}>
                          {f.name}
                        </button>
                      )}
                    </Fragment>
                  ))}
                </>
              )}
            </nav>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button className={files.button} onClick={() => setDialog({ type: "newFolder" })}>
                New folder
              </button>
              <button className={files.primaryButton} onClick={() => fileInput.current?.click()}>
                Upload
              </button>
            </div>
          </div>

          <FileList
            items={visible}
            pendingIds={NO_PENDING}
            loading={loading}
            searching={false}
            onOpen={(i) => open(i as VaultItem)}
            onMenu={(i, x, y) => showItemMenu(i as VaultItem, x, y)}
            onDelete={(i) => setDialog({ type: "delete", item: i as VaultItem })}
            onRename={(i) => setDialog({ type: "rename", item: i as VaultItem })}
            emptyState={
              <div className={files.empty}>
                <div className={files.emptyArt}>🔐</div>
                <div className={files.emptyTitle}>{chain.length ? "This folder is empty" : "Your Secure Vault is empty"}</div>
                <div>Drop files here to encrypt and store them, or</div>
                <button className={files.primaryButton} onClick={() => fileInput.current?.click()} style={{ marginTop: 6 }}>
                  Upload files
                </button>
              </div>
            }
          />

          {dragging && (
            <div className={files.dropOverlay}>
              <div className={files.dropCard}>Drop to encrypt and store in the vault</div>
            </div>
          )}
        </main>
      </div>

      <button className={files.fab} onClick={showNewMenu} aria-label="New">
        <PlusIcon size={26} />
      </button>

      <input
        ref={fileInput}
        type="file"
        multiple
        accept={ACCEPT.replace(",.zip", "")}
        hidden
        onChange={(e) => {
          upload(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />

      {uploads.length > 0 && (
        <section className={files.uploadPanel} aria-label="Uploads">
          <div className={files.uploadHeader}>
            <span className={files.uploadTitle} aria-live="polite">
              {working ? `Encrypting and uploading ${working}…` : "Uploads finished"}
            </span>
            {!working && (
              <button className={files.iconButton} onClick={() => setUploads([])} aria-label="Close">
                <CloseIcon />
              </button>
            )}
          </div>
          <div className={files.uploadList}>
            {uploads
              .slice()
              .reverse()
              .map((u) => (
                <div key={u.key} className={files.uploadRow}>
                  <FileIcon name={u.name} />
                  <div style={{ minWidth: 0 }}>
                    <div className={files.uploadName}>{u.name}</div>
                    <div className={u.state === "failed" ? files.uploadMetaError : files.uploadMeta}>
                      {u.message ?? (u.state === "done" ? `${formatBytes(u.size)} · encrypted` : `${Math.round(u.progress * 100)}%`)}
                    </div>
                    {u.state === "working" && (
                      <div className={files.uploadBar}>
                        <div className={files.uploadBarFill} style={{ width: `${u.progress * 100}%` }} />
                      </div>
                    )}
                  </div>
                  <span className={files.statusIcon}>
                    {u.state === "done" && <CheckIcon size={20} style={{ color: "#30a46c" }} />}
                    {u.state === "failed" && <AlertIcon size={20} style={{ color: "#e5484d" }} />}
                  </span>
                </div>
              ))}
          </div>
        </section>
      )}

      {menu && <Menu {...menu} onClose={() => setMenu(null)} />}

      {dialog?.type === "newFolder" && (
        <NameDialog
          title="New folder"
          initial={uniqueName("Untitled folder", items.map((i) => i.name))}
          submitLabel="Create"
          onSubmit={(name) => createVaultFolder(uid, vaultKey, folder, name).catch(() => setToast("Couldn't create the folder"))}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === "rename" && (
        <NameDialog
          title="Rename"
          initial={dialog.item.name}
          submitLabel="OK"
          onSubmit={(name) =>
            name !== dialog.item.name && renameVaultItem(uid, vaultKey, dialog.item, name).catch(() => setToast("Couldn't rename"))
          }
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === "delete" && (
        <ConfirmDialog
          title={`Delete “${dialog.item.name}”?`}
          text={
            dialog.item.kind === "folder"
              ? "This folder and everything inside it will be permanently deleted."
              : "This file will be permanently deleted."
          }
          confirmLabel="Delete"
          onConfirm={() =>
            deleteVaultItems(uid, [dialog.item])
              .then(() => setToast(`Deleted “${dialog.item.name}”`))
              .catch(() => setToast("Couldn't delete"))
          }
          onClose={() => setDialog(null)}
        />
      )}

      {toast && (
        <div className={files.toast} role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
