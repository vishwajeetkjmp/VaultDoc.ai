"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "./files.module.css";

export type MenuAction = {
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  onSelect: () => void;
} | "divider";

/**
 * Dropdown / right-click menu positioned at a point, kept inside the window.
 * Closes on outside click, Escape, scroll or resize. Arrow keys move focus.
 */
export function Menu({ x, y, actions, onClose }: { x: number; y: number; actions: MenuAction[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      left: Math.max(8, Math.min(x, window.innerWidth - width - 8)),
      top: y + height > window.innerHeight - 8 ? Math.max(8, y - height) : y,
    });
    el.querySelector<HTMLButtonElement>("button")?.focus();
  }, [x, y]);

  useEffect(() => {
    const close = (e: Event) => {
      if (e.type === "mousedown" && ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const buttons = Array.from(ref.current?.querySelectorAll("button") ?? []);
      const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
      buttons[(i + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus();
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [onClose]);

  return (
    <div ref={ref} role="menu" className={styles.menu} style={pos}>
      {actions.map((a, i) =>
        a === "divider" ? (
          <div key={i} className={styles.menuDivider} />
        ) : (
          <button
            key={a.label}
            role="menuitem"
            className={a.danger ? styles.menuItemDanger : styles.menuItem}
            onClick={() => {
              onClose();
              a.onSelect();
            }}
          >
            {a.icon}
            {a.label}
          </button>
        ),
      )}
    </div>
  );
}

function Dialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={styles.backdrop} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.dialog} role="dialog" aria-modal aria-label={title}>
        <div className={styles.dialogTitle}>{title}</div>
        {children}
      </div>
    </div>
  );
}

/** Single text field dialog (new folder, rename). Selects the name without its extension, like Drive. */
export function NameDialog({
  title,
  initial,
  submitLabel,
  onSubmit,
  onClose,
}: {
  title: string;
  initial: string;
  submitLabel: string;
  onSubmit: (name: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initial);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.focus();
    const dot = initial.lastIndexOf(".");
    el.setSelectionRange(0, dot > 0 ? dot : initial.length);
  }, [initial]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = value.trim();
    if (!name) return;
    onSubmit(name);
    onClose();
  };

  return (
    <Dialog title={title} onClose={onClose}>
      <form onSubmit={submit}>
        <input
          ref={input}
          className={styles.dialogInput}
          value={value}
          maxLength={255}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Name"
        />
        <div className={styles.dialogActions}>
          <button type="button" className={styles.button} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={styles.primaryButton} disabled={!value.trim()}>
            {submitLabel}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export function ConfirmDialog({
  title,
  text,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  text: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const confirm = useRef<HTMLButtonElement>(null);
  useEffect(() => confirm.current?.focus(), []);
  return (
    <Dialog title={title} onClose={onClose}>
      <p className={styles.dialogText}>{text}</p>
      <div className={styles.dialogActions}>
        <button className={styles.button} onClick={onClose}>
          Cancel
        </button>
        <button
          ref={confirm}
          className={styles.dangerButton}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
