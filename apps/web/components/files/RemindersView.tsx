"use client";

import { useEffect, useState } from "react";
import { deleteReminder, listenReminders, Reminder } from "../../lib/files/ai";
import files from "./files.module.css";
import styles from "./ai.module.css";
import { TrashIcon } from "./icons";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function daysUntil(date: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${date}T00:00:00`).getTime() - today.getTime()) / 86_400_000);
}

/** Upcoming deadlines the user asked to be reminded about (from the AI summary of a file). */
export default function RemindersView({ uid, onToast, onOpenItem }: { uid: string; onToast: (m: string) => void; onOpenItem: (itemId: string) => void }) {
  const [list, setList] = useState<Reminder[] | null>(null);

  useEffect(
    () =>
      listenReminders(uid, setList, () => {
        setList([]);
        onToast("Couldn't load reminders. Check your connection.");
      }),
    [uid, onToast],
  );

  if (!list) return <div className={files.empty} aria-busy="true" />;
  if (!list.length) {
    return (
      <div className={files.empty}>
        <div className={files.emptyArt} style={{ fontSize: 34 }}>
          🔔
        </div>
        <div className={files.emptyTitle}>No reminders yet</div>
        <div style={{ maxWidth: 380, textAlign: "center" }}>
          Open a document, choose <b>Ask AI → Summarise</b>, then tap <b>Remind me</b> on any important date. We&apos;ll email you 30, 7 and 1 days
          before, and on the day.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.reminderList}>
      {list.map((r) => {
        const d = daysUntil(r.date);
        const [y, m, day] = r.date.split("-");
        return (
          <div key={r.id} className={styles.reminderRow}>
            <div className={styles.dateBox}>
              <b>{Number(day)}</b>
              <span>
                {MONTHS[Number(m) - 1]} {y.slice(2)}
              </span>
            </div>
            <div className={styles.dateText} style={{ cursor: "pointer" }} onClick={() => onOpenItem(r.itemId)} title="Open the document's AI summary">
              <div style={{ fontWeight: 600 }}>{r.label}</div>
              <div>
                📄 {r.itemName} ·{" "}
                {d < 0 ? (
                  <span className={styles.overdue}>{-d === 1 ? "yesterday" : `${-d} days ago`}</span>
                ) : d === 0 ? (
                  <span className={styles.overdue}>today</span>
                ) : (
                  `in ${d} day${d === 1 ? "" : "s"}`
                )}
                {r.nextNotifyAt && ` · next email ${r.nextNotifyAt.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`}
              </div>
            </div>
            <button
              className={files.iconButton}
              aria-label={`Delete reminder ${r.label}`}
              title="Delete reminder"
              onClick={() =>
                deleteReminder(uid, r.id)
                  .then(() => onToast("Reminder deleted"))
                  .catch(() => onToast("Couldn't delete the reminder"))
              }
            >
              <TrashIcon size={18} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
