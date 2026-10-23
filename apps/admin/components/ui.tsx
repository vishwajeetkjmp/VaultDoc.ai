"use client";

import { useEffect, useRef, useState } from "react";

export function Stat({ label, value, note }: { label: string; value: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="card stat">
      <div className="statLabel">{label}</div>
      <div className="statValue">{value}</div>
      {note && <div className="statNote">{note}</div>}
    </div>
  );
}

export function Card({ title, subtitle, actions, children, flush }: { title?: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode; flush?: boolean }) {
  return (
    <section className="card">
      {title && (
        <div className="cardHead">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <span className="spacer" />
          {actions}
        </div>
      )}
      <div className={flush ? undefined : "cardBody"} style={flush && title ? { marginTop: 12 } : undefined}>
        {children}
      </div>
    </section>
  );
}

export function UserCell({ email, name, photo }: { email: string | null; name?: string | null; photo?: string | null }) {
  return (
    <div className="cellUser">
      <span className="avatar">{photo ? <img src={photo} alt="" referrerPolicy="no-referrer" /> : (name || email || "?").slice(0, 1)}</span>
      <div style={{ minWidth: 0 }}>
        <div className="ellipsis" style={{ fontWeight: 550 }}>
          {name || email || "—"}
        </div>
        {name && email && <div className="ellipsis muted small">{email}</div>}
      </div>
    </div>
  );
}

export function SkeletonRows({ cols, rows = 6 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }, (_, c) => (
            <td key={c}>
              <div className="skeleton" style={{ height: 12, width: `${40 + ((r * 7 + c * 13) % 50)}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Slide-over detail panel; Escape or the backdrop closes it. */
export function SlideOver({ title, subtitle, onClose, children }: { title: React.ReactNode; subtitle?: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <aside className="panel" role="dialog" aria-modal>
        <div className="panelHead">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 650, fontSize: 15 }}>{title}</div>
            {subtitle && <div className="muted small">{subtitle}</div>}
          </div>
          <button className="btn btnGhost" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="panelBody">{children}</div>
      </aside>
    </>
  );
}

/**
 * Confirmation for any change: asks for a reason (saved in the audit log).
 * `extra` adds fields (e.g. a quota), validated by `ready`.
 */
export function ReasonDialog({
  title,
  text,
  confirmLabel,
  danger,
  extra,
  ready = true,
  onConfirm,
  onClose,
}: {
  title: string;
  text: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  extra?: React.ReactNode;
  ready?: boolean;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => input.current?.focus(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (err) {
      setError((err as Error).message || "Something went wrong.");
      setBusy(false);
    }
  };

  return (
    <div className="dialogWrap" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <form className="dialog" role="dialog" aria-modal aria-label={title} onSubmit={submit}>
        <h3>{title}</h3>
        <div className="muted">{text}</div>
        {extra}
        <label style={{ display: "grid", gap: 6 }}>
          <span className="small" style={{ fontWeight: 600 }}>
            Reason <span className="muted">(saved in the audit log)</span>
          </span>
          <textarea ref={input} className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. User asked by email on 24 Oct" maxLength={500} />
        </label>
        {error && <div className="badge bad" style={{ height: "auto", padding: "6px 10px", whiteSpace: "normal" }}>{error}</div>}
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className={`btn ${danger ? "btnDanger" : "btnPrimary"}`} disabled={busy || reason.trim().length < 3 || !ready}>
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
