"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { User } from "firebase/auth";
import ProfileMenu from "../ProfileMenu";
import ThemeMenu from "../ThemeMenu";
import { ACCEPT, SUPPORTED_LABEL } from "../../lib/files/fileTypes";
import { formatBytes } from "../../lib/files/format";
import {
  cachedFolderItems,
  createFolder,
  deleteItems,
  FolderRef,
  getFolderChain,
  getItem,
  Item,
  listenFolder,
  openFile,
  renameItem,
  ROOT_FOLDER,
  ROOT_ID,
  uniqueName,
} from "../../lib/files/items";
import { useStorageAccount } from "../../lib/files/limits";
import { uploadQueue, usePendingItemIds } from "../../lib/files/uploader";
import FileList, { EmptyFolder } from "./FileList";
import styles from "./files.module.css";
import {
  ChevronRightIcon,
  DownloadIcon,
  FolderPlusIcon,
  HomeIcon,
  OpenIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
  UploadIcon,
} from "./icons";
import { ConfirmDialog, Menu, MenuAction, NameDialog } from "./Popups";
import StorageMeter from "./StorageMeter";
import UploadPanel from "./UploadPanel";

type DialogState =
  | { type: "newFolder" }
  | { type: "rename"; item: Item }
  | { type: "delete"; item: Item }
  | null;

export default function FilesApp({ user }: { user: User }) {
  const uid = user.uid;
  const router = useRouter();
  const pathname = usePathname();
  const folderId = useSearchParams().get("folder") ?? ROOT_ID;

  const account = useStorageAccount(uid);
  const accountRef = useRef(account);
  accountRef.current = account;

  const [items, setItems] = useState<Item[]>(() => cachedFolderItems(folderId));
  const [loading, setLoading] = useState(true);
  const [chain, setChain] = useState<Item[]>([]); // folders from the top down to the current one
  const [search, setSearch] = useState("");
  const [menu, setMenu] = useState<{ x: number; y: number; actions: MenuAction[] } | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const pendingIds = usePendingItemIds();

  const current = chain[chain.length - 1];
  const folder: FolderRef = folderId === ROOT_ID || !current ? ROOT_FOLDER : { id: current.id, ancestorIds: current.ancestorIds };
  const folderName = folderId === ROOT_ID ? "My Files" : current?.name ?? "";

  const showToast = useCallback((message: string) => setToast(message), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Live folder contents (cache first, then server)
  useEffect(() => {
    setItems(cachedFolderItems(folderId));
    setLoading(true);
    setSearch("");
    return listenFolder(
      uid,
      folderId,
      (list, fromCache) => {
        setItems(list);
        if (!fromCache || list.length) setLoading(false);
      },
      () => {
        setLoading(false);
        showToast("Couldn't load this folder. Check your connection.");
      },
    );
  }, [uid, folderId, showToast]);

  // Breadcrumbs for the current folder
  useEffect(() => {
    if (folderId === ROOT_ID) {
      setChain([]);
      return;
    }
    let cancelled = false;
    getItem(uid, folderId).then(async (f) => {
      if (cancelled) return;
      if (!f || f.kind !== "folder") {
        router.replace(pathname);
        return;
      }
      const full = await getFolderChain(uid, f);
      if (!cancelled) setChain(full);
    });
    return () => {
      cancelled = true;
    };
  }, [uid, folderId, pathname, router]);

  // Warn before closing the tab mid-upload
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (uploadQueue.activeCount > 0) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const goTo = useCallback(
    (target: Item | null) => {
      // Update breadcrumbs right away (the effect below confirms them from the database)
      if (target) {
        setChain((c) => {
          const at = c.findIndex((f) => f.id === target.id);
          if (at >= 0) return c.slice(0, at + 1); // clicked a breadcrumb
          if (target.parentId === ROOT_ID) return [target];
          const parent = c.findIndex((f) => f.id === target.parentId);
          return parent >= 0 ? [...c.slice(0, parent + 1), target] : c; // opened a subfolder
        });
      } else {
        setChain([]);
      }
      router.push(target ? `${pathname}?folder=${target.id}` : pathname);
    },
    [pathname, router],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => (i.status === "ready" || pendingIds.has(i.id)) && (!q || i.name.toLowerCase().includes(q)));
  }, [items, pendingIds, search]);

  const upload = useCallback(
    (files: File[]) => {
      if (!files.length) return;
      uploadQueue.addFiles(files, {
        uid,
        folder,
        account: () => {
          const a = accountRef.current;
          return { usedBytes: a.usedBytes, quotaBytes: a.quotaBytes, limits: a.limits };
        },
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uid, folder.id],
  );

  const open = useCallback(
    (item: Item) => {
      if (item.kind === "folder") goTo(item);
      else openFile(item, "open").catch(() => showToast(`Couldn't open “${item.name}”`));
    },
    [goTo, showToast],
  );

  const showItemMenu = useCallback(
    (item: Item, x: number, y: number) => {
      const actions: MenuAction[] = [
        { label: "Open", icon: <OpenIcon size={18} />, onSelect: () => open(item) },
      ];
      if (item.kind === "file") {
        actions.push({
          label: "Download",
          icon: <DownloadIcon size={18} />,
          onSelect: () => openFile(item, "download").catch(() => showToast(`Couldn't download “${item.name}”`)),
        });
      }
      actions.push(
        { label: "Rename", icon: <PencilIcon size={18} />, onSelect: () => setDialog({ type: "rename", item }) },
        "divider",
        { label: "Delete", icon: <TrashIcon size={18} />, danger: true, onSelect: () => setDialog({ type: "delete", item }) },
      );
      setMenu({ x, y, actions });
    },
    [open, showToast],
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

  // Drag and drop anywhere over the file area
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files");
  const dropHandlers = {
    onDragEnter: (e: React.DragEvent) => {
      if (!hasFiles(e)) return;
      dragDepth.current++;
      setDragging(true);
    },
    onDragOver: (e: React.DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    },
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

  const remove = async (item: Item) => {
    try {
      await deleteItems(uid, [item]);
      showToast(`Deleted “${item.name}”`);
    } catch {
      showToast(`Couldn't delete “${item.name}”`);
    }
  };

  return (
    <div className={styles.app}>
      <header className={styles.topbar}>
        <a href="/" className={styles.brand}>
          <span className={styles.brandMark}>🔒</span>
          <span className={styles.brandName}>VaultDocAI</span>
        </a>
        <label className={styles.search}>
          <SearchIcon size={18} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setSearch("")}
            placeholder={`Search in ${folderName}`}
            aria-label={`Search in ${folderName}`}
          />
        </label>
        <div className={styles.topRight}>
          <span className={styles.hideOnMobile}>
            <ThemeMenu />
          </span>
          <ProfileMenu user={user} />
        </div>
      </header>

      <div className={styles.body}>
        <aside className={styles.sidebar}>
          <button className={styles.newButton} onClick={showNewMenu} aria-haspopup="menu">
            <PlusIcon size={22} />
            New
          </button>
          <button className={styles.navItem} onClick={() => goTo(null)} style={{ border: 0, textAlign: "left" }}>
            <HomeIcon size={18} />
            My Files
          </button>
          <a href="/vault" className={styles.navItem} style={{ background: "transparent" }}>
            <span aria-hidden>🔐</span>
            Secure Vault
          </a>
          <div className={styles.sidebarFooter}>
            <StorageMeter uid={uid} />
            <div className={styles.meterText} style={{ marginTop: 4 }}>
              Max {formatBytes(account.limits.maxFileBytes)} per file
            </div>
          </div>
        </aside>

        <main className={styles.main} {...dropHandlers}>
          <div className={styles.toolbar}>
            <nav className={styles.crumbs} aria-label="Folder path">
              {folderId === ROOT_ID ? (
                <span className={styles.crumbCurrent}>My Files</span>
              ) : (
                <>
                  <button className={styles.crumb} onClick={() => goTo(null)}>
                    My Files
                  </button>
                  {chain.map((f, i) => (
                    <Fragment key={f.id}>
                      <ChevronRightIcon size={18} className={styles.crumbSep} />
                      {i === chain.length - 1 ? (
                        <span className={styles.crumbCurrent} aria-current="page" title={f.name}>
                          {f.name}
                        </span>
                      ) : (
                        <button className={styles.crumb} onClick={() => goTo(f)} title={f.name}>
                          {f.name}
                        </button>
                      )}
                    </Fragment>
                  ))}
                </>
              )}
            </nav>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button className={styles.button} onClick={() => setDialog({ type: "newFolder" })}>
                New folder
              </button>
              <button className={styles.primaryButton} onClick={() => fileInput.current?.click()}>
                Upload
              </button>
            </div>
          </div>

          <FileList
            items={visible}
            pendingIds={pendingIds}
            loading={loading}
            searching={!!search.trim()}
            onOpen={open}
            onMenu={showItemMenu}
            onDelete={(item) => setDialog({ type: "delete", item })}
            onRename={(item) => setDialog({ type: "rename", item })}
            emptyState={<EmptyFolder isRoot={folderId === ROOT_ID} onUpload={() => fileInput.current?.click()} />}
          />

          {dragging && (
            <div className={styles.dropOverlay}>
              <div className={styles.dropCard}>
                Drop to upload to “{folderName}”
                <div style={{ fontSize: 12, fontWeight: 500, opacity: 0.85, marginTop: 4 }}>{SUPPORTED_LABEL}</div>
              </div>
            </div>
          )}
        </main>
      </div>

      <button className={styles.fab} onClick={showNewMenu} aria-label="New">
        <PlusIcon size={26} />
      </button>

      <input
        ref={fileInput}
        type="file"
        multiple
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          upload(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />

      <UploadPanel />

      {menu && <Menu {...menu} onClose={() => setMenu(null)} />}

      {dialog?.type === "newFolder" && (
        <NameDialog
          title="New folder"
          initial={uniqueName("Untitled folder", items.map((i) => i.name))}
          submitLabel="Create"
          onSubmit={(name) => createFolder(uid, folder, name)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === "rename" && (
        <NameDialog
          title="Rename"
          initial={dialog.item.name}
          submitLabel="OK"
          onSubmit={(name) =>
            name !== dialog.item.name &&
            renameItem(uid, dialog.item.id, name).catch(() => showToast("Couldn't rename"))
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
          onConfirm={() => remove(dialog.item)}
          onClose={() => setDialog(null)}
        />
      )}

      {toast && (
        <div className={styles.toast} role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
