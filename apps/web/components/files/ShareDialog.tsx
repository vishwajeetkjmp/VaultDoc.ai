"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { callError } from "../../lib/callable";
import type { Item } from "../../lib/files/items";
import { MyShare, revokeShare, saveShare, ShareMode, shareUrl } from "../../lib/files/shares";
import FileIcon from "./FileIcon";
import { CloseIcon, DownloadIcon, EyeIcon, GlobeIcon, LinkIcon, LockIcon } from "./icons";
import { Dialog } from "./Popups";
import files from "./files.module.css";
import styles from "./share.module.css";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DAY = 86_400_000;
type Expiry = "never" | "1" | "7" | "30" | "custom";

const dateInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

/** Drive-style share dialog: invite people by email, choose who can open the link, set an expiry. Loaded on demand. */
export default function ShareDialog({
  item,
  existing,
  onClose,
  onToast,
}: {
  item: Item;
  existing?: MyShare;
  onClose: () => void;
  onToast: (message: string) => void;
}) {
  const [mode, setMode] = useState<ShareMode>(existing?.mode ?? "link");
  const [people, setPeople] = useState<string[]>(existing?.invitees ?? []);
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("");
  const [expiry, setExpiry] = useState<Expiry>(existing?.expiresAt ? "custom" : "never");
  const [customDate, setCustomDate] = useState(dateInput(existing?.expiresAt ?? new Date(Date.now() + 7 * DAY)));
  const [busy, setBusy] = useState<"save" | "copy" | "stop" | null>(null);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);

  const newPeople = useMemo(() => people.filter((p) => !existing?.invitees.includes(p)), [people, existing]);
  const invalid = people.filter((p) => !EMAIL.test(p));

  const expiresAt = (): number | null => {
    if (expiry === "never") return null;
    if (expiry === "custom") return new Date(`${customDate}T23:59:59`).getTime();
    return Date.now() + Number(expiry) * DAY;
  };

  const addDraft = (text = draft) => {
    const parts = text.split(/[\s,;]+/).map((p) => p.trim().toLowerCase()).filter(Boolean);
    if (parts.length) setPeople((list) => [...new Set([...list, ...parts])]);
    setDraft("");
  };

  const save = async (): Promise<string | null> => {
    setError("");
    if (invalid.length) {
      setError(`Check ${invalid.length === 1 ? "this address" : "these addresses"}: ${invalid.join(", ")}`);
      return null;
    }
    if (mode === "invite" && !people.length) {
      setError("Add at least one email, or choose “Anyone with the link”.");
      return null;
    }
    const r = await saveShare({ itemId: item.id, mode, invitees: people, expiresAt: expiresAt(), message });
    if (r.emailFailed) setError(`Saved, but ${r.emailFailed} email${r.emailFailed > 1 ? "s" : ""} couldn't be sent. Copy the link and send it yourself.`);
    return r.linkId;
  };

  const onSave = async () => {
    setBusy("save");
    try {
      const linkId = await save();
      if (!linkId) return;
      onToast(newPeople.length ? `Shared with ${newPeople.length} ${newPeople.length === 1 ? "person" : "people"}` : "Sharing settings saved");
      onClose();
    } catch (e) {
      setError(callError(e).message);
    } finally {
      setBusy(null);
    }
  };

  const onCopy = async () => {
    setBusy("copy");
    try {
      // Unsaved changes (or no share yet): save first, so the copied link works the way it's shown
      const linkId = existing && !dirty ? existing.linkId : await save();
      if (!linkId) return;
      await navigator.clipboard.writeText(shareUrl(linkId));
      onToast("Link copied");
      if (!existing) onClose();
    } catch (e) {
      setError(callError(e).message);
    } finally {
      setBusy(null);
    }
  };

  const onStop = async () => {
    if (!existing) return;
    setBusy("stop");
    try {
      await revokeShare(existing.linkId);
      onToast(`Stopped sharing “${item.name}”`);
      onClose();
    } catch (e) {
      setError(callError(e).message);
      setBusy(null);
    }
  };

  const dirty =
    !existing ||
    mode !== existing.mode ||
    people.join() !== existing.invitees.join() ||
    !!message.trim() ||
    (expiry === "never") !== !existing.expiresAt ||
    (expiry === "custom" && existing.expiresAt && customDate !== dateInput(existing.expiresAt)) ||
    (expiry !== "never" && expiry !== "custom");

  return (
    <Dialog title={`Share “${item.name}”`} onClose={onClose} wide>
      <div className={styles.itemHeader}>
        <FileIcon name={item.name} folder={item.kind === "folder"} />
        <span>{item.kind === "folder" ? "Folder: everything inside is shared, including files added later" : "File"}</span>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Add people by email</div>
        <div className={styles.chips} onClick={() => input.current?.focus()}>
          {people.map((p) => (
            <span key={p} className={EMAIL.test(p) ? styles.chip : styles.chipBad} title={EMAIL.test(p) ? p : "Not a valid email"}>
              {p}
              <button aria-label={`Remove ${p}`} onClick={() => setPeople((l) => l.filter((x) => x !== p))}>
                <CloseIcon size={13} />
              </button>
            </span>
          ))}
          <input
            ref={input}
            className={styles.chipInput}
            value={draft}
            placeholder={people.length ? "" : "name@example.com"}
            // Typing a space, comma or semicolon turns what's typed into a chip
            onChange={(e) => (/[\s,;]$/.test(e.target.value) ? addDraft(e.target.value) : setDraft(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && draft.trim()) {
                e.preventDefault();
                addDraft();
              } else if (e.key === "Backspace" && !draft && people.length) {
                setPeople((l) => l.slice(0, -1));
              }
            }}
            onBlur={() => addDraft()}
            onPaste={(e) => {
              const text = e.clipboardData.getData("text");
              if (/[\s,;]/.test(text)) {
                e.preventDefault();
                addDraft(draft + text);
              }
            }}
            aria-label="Email addresses"
          />
        </div>
        {newPeople.length > 0 && (
          <textarea
            className={styles.message}
            value={message}
            maxLength={500}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Add a message (optional)"
            aria-label="Message"
          />
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Who can open the link</div>
        <div className={styles.access} role="radiogroup">
          <button role="radio" aria-checked={mode === "link"} className={styles.accessCard} onClick={() => setMode("link")}>
            <span className={styles.accessIcon}>
              <GlobeIcon size={17} />
            </span>
            <span>
              <div className={styles.accessTitle}>Anyone with the link</div>
              <div className={styles.accessText}>No account needed to view and download.</div>
            </span>
          </button>
          <button role="radio" aria-checked={mode === "invite"} className={styles.accessCard} onClick={() => setMode("invite")}>
            <span className={styles.accessIcon}>
              <LockIcon size={17} />
            </span>
            <span>
              <div className={styles.accessTitle}>Only people you invite</div>
              <div className={styles.accessText}>They log in with the invited email to open it.</div>
            </span>
          </button>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Link expires</div>
        <div className={styles.row}>
          <select className={styles.select} value={expiry} onChange={(e) => setExpiry(e.target.value as Expiry)} aria-label="Link expires">
            <option value="never">Never</option>
            <option value="1">In 1 day</option>
            <option value="7">In 7 days</option>
            <option value="30">In 30 days</option>
            <option value="custom">On a date…</option>
          </select>
          {expiry === "custom" && (
            <input
              type="date"
              className={styles.select}
              value={customDate}
              min={dateInput(new Date(Date.now() + DAY))}
              max={dateInput(new Date(Date.now() + 365 * DAY))}
              onChange={(e) => setCustomDate(e.target.value)}
              aria-label="Expiry date"
            />
          )}
        </div>
      </div>

      {existing && (
        <div className={styles.section}>
          <div className={styles.stats}>
            <span>
              <EyeIcon size={15} /> {existing.views} {existing.views === 1 ? "view" : "views"}
            </span>
            <span>
              <DownloadIcon size={15} /> {existing.downloads} {existing.downloads === 1 ? "download" : "downloads"}
            </span>
            {existing.lastOpenedAt && <span>Last opened {existing.lastOpenedAt.toLocaleString()}</span>}
          </div>
        </div>
      )}

      {error && <div className={styles.error} role="alert">{error}</div>}
      {!error && mode === "link" && <div className={styles.note}>Anyone who gets this link can open it, even if it's forwarded. Use “Only people you invite” for private papers.</div>}

      <div className={styles.footer}>
        <button className={styles.linkButton} onClick={onCopy} disabled={!!busy}>
          <LinkIcon size={16} />
          {busy === "copy" ? "Copying…" : "Copy link"}
        </button>
        {existing && (
          <button className={styles.textDanger} onClick={onStop} disabled={!!busy}>
            {busy === "stop" ? "Stopping…" : "Stop sharing"}
          </button>
        )}
        <span className={styles.spacer} />
        <button className={files.button} onClick={onClose} disabled={!!busy}>
          Cancel
        </button>
        <button className={files.primaryButton} onClick={onSave} disabled={!!busy || (!!existing && !dirty)}>
          {busy === "save" ? "Saving…" : newPeople.length ? "Send" : "Save"}
        </button>
      </div>
    </Dialog>
  );
}
