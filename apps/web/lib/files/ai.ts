import { httpsCallable } from "firebase/functions";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, Timestamp, updateDoc } from "firebase/firestore";
import { call, fns } from "../callable";
import { db } from "./cloud";

/** AI for My Space files (see functions/src/ai.ts). Loaded only when the AI panel or Reminders open. */

export type Analysis = {
  docType: string;
  title: string;
  summary: string[];
  parties: string[];
  amounts: { label: string; value: string }[];
  dates: { label: string; date: string; kind: string }[];
};
export type Quota = { used: number; limit: number };
export type Citation = { page?: number; text: string };
export type ChatTurn = { role: "user" | "assistant"; text: string; citations?: Citation[] };

/** File types the AI can read (keep in sync with aiSupported in functions/src/ai.ts). */
export function aiCanRead(contentType: string | null): boolean {
  return (
    !!contentType &&
    (contentType === "application/pdf" ||
      /^image\/(png|jpeg|webp|gif)$/.test(contentType) ||
      /^(text\/(plain|csv|markdown)|application\/json)$/.test(contentType) ||
      /^application\/(msword|vnd\.openxmlformats-officedocument\.|vnd\.ms-excel|vnd\.ms-powerpoint|rtf)/.test(contentType))
  );
}

/** Switches AI on or off for this account (the user's consent). */
export const setAiEnabled = (uid: string, enabled: boolean) =>
  updateDoc(doc(db(), "users", uid), { aiEnabled: enabled, aiConsentAt: serverTimestamp() });

export const aiInfo = (itemId: string) =>
  call<{ itemId: string }, { supported: boolean; quota: Quota; analysis: Analysis | null }>("aiInfo", { itemId });

export const aiAnalyze = (itemId: string) => call<{ itemId: string }, { analysis: Analysis; quota: Quota }>("aiAnalyze", { itemId });

/** Asks a question; `onText` receives the answer as it's written. */
export async function aiAsk(
  itemId: string,
  question: string,
  history: ChatTurn[],
  onText: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<{ text: string; citations: Citation[]; quota: Quota }> {
  const fn = httpsCallable<object, { text: string; citations: Citation[]; quota: Quota }, string>(fns(), "aiAsk", { timeout: 120_000 });
  const { stream, data } = await fn.stream(
    { itemId, question, history: history.map(({ role, text }) => ({ role, text })) },
    { signal },
  );
  for await (const chunk of stream) onText(chunk);
  return data;
}

// ---------- Reminders ----------

export type Reminder = { id: string; itemId: string; itemName: string; label: string; date: string; nextNotifyAt: Date | null };

const REMINDER_DAYS = [30, 7, 1, 0];

/** Next reminder email: 30, 7, 1 days before and on the day, at 09:00 India time (same rule as the server). */
export function nextNotifyAt(date: string, after = Date.now()): Date | null {
  const due = Date.parse(`${date}T09:00:00+05:30`);
  for (const days of REMINDER_DAYS) {
    const at = due - days * 86_400_000;
    if (at > after) return new Date(at);
  }
  return null;
}

export function addReminder(uid: string, r: { itemId: string; itemName: string; label: string; date: string }) {
  const next = nextNotifyAt(r.date);
  return addDoc(collection(db(), "users", uid, "reminders"), {
    ...r,
    label: r.label.slice(0, 120),
    nextNotifyAt: next ? Timestamp.fromDate(next) : null,
    createdAt: serverTimestamp(),
  });
}

export const deleteReminder = (uid: string, id: string) => deleteDoc(doc(db(), "users", uid, "reminders", id));

export function listenReminders(uid: string, onChange: (list: Reminder[]) => void, onError?: () => void) {
  return onSnapshot(
    query(collection(db(), "users", uid, "reminders"), orderBy("date")),
    (snap) =>
      onChange(
        snap.docs.map((d) => {
          const x = d.data();
          return { id: d.id, itemId: x.itemId, itemName: x.itemName, label: x.label, date: x.date, nextNotifyAt: x.nextNotifyAt instanceof Timestamp ? x.nextNotifyAt.toDate() : null };
        }),
      ),
    () => onError?.(),
  );
}
