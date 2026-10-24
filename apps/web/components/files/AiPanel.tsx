"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { callError } from "../../lib/callable";
import {
  addReminder,
  aiAnalyze,
  aiAsk,
  aiInfo,
  Analysis,
  ChatTurn,
  listenReminders,
  Quota,
  Reminder,
  setAiEnabled,
} from "../../lib/files/ai";
import type { Item } from "../../lib/files/items";
import files from "./files.module.css";
import styles from "./ai.module.css";

type Tab = "summary" | "ask";
type State = { status: "loading" } | { status: "consent" } | { status: "ready"; supported: boolean } | { status: "error"; message: string };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Suggested first questions, tuned to the kind of document once it's known. */
function suggestionsFor(docType?: string): string[] {
  const t = (docType ?? "").toLowerCase();
  const common = ["What is this document about, in simple words?", "What are the important dates and deadlines?"];
  if (/rent|lease|agreement|contract/.test(t)) return [...common, "What happens if I want to leave early?", "Are there any penalties or extra charges?"];
  if (/insurance|policy/.test(t)) return [...common, "What is covered and what is not covered?", "How do I make a claim?"];
  if (/invoice|bill|receipt|statement/.test(t)) return [...common, "What is the total amount and when is it due?", "Are there any unusual charges?"];
  if (/medical|report|prescription/.test(t)) return [...common, "Explain these results in simple language", "Which values are outside the normal range?"];
  return [...common, "Explain this in simple Hindi", "Is there anything I need to do?"];
}

/** Slide-in AI panel for one file: Summary (key details + reminders) and Ask (chat with page references). */
export default function AiPanel({ uid, item, onClose }: { uid: string; item: Item; onClose: () => void }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [tab, setTab] = useState<Tab>("summary");
  const [quota, setQuota] = useState<Quota | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const r = await aiInfo(item.id);
      setQuota(r.quota);
      setAnalysis(r.analysis);
      setState({ status: "ready", supported: r.supported });
      if (!r.analysis) setTab("summary");
    } catch (e) {
      const err = callError(e);
      setState(err.reason === "consent" ? { status: "consent" } : { status: "error", message: err.message });
    }
  }, [item.id]);
  useEffect(() => void load(), [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const left = quota ? Math.max(0, quota.limit - quota.used) : null;

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <aside className={styles.panel} role="dialog" aria-modal aria-label={`Ask AI about ${item.name}`}>
        <div className={styles.head}>
          <span className={styles.spark} aria-hidden>
            ✨
          </span>
          <div className={styles.headText}>
            <div className={styles.headTitle}>Ask AI</div>
            <div className={styles.headFile} title={item.name}>
              {item.name}
            </div>
          </div>
          <button className={styles.close} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {state.status === "ready" && state.supported && (
          <div className={styles.tabs} role="tablist">
            <button role="tab" aria-selected={tab === "summary"} className={styles.tab} onClick={() => setTab("summary")}>
              Summary
            </button>
            <button role="tab" aria-selected={tab === "ask"} className={styles.tab} onClick={() => setTab("ask")}>
              Ask
            </button>
            {left !== null && (
              <span className={styles.quota} title="Free AI questions reset every day at midnight">
                {left} of {quota!.limit} left today
              </span>
            )}
          </div>
        )}

        {state.status === "loading" && (
          <div className={styles.body} aria-busy="true">
            {[80, 60, 90, 40].map((w) => (
              <div key={w} className={styles.skeleton} style={{ width: `${w}%` }} />
            ))}
          </div>
        )}
        {state.status === "error" && (
          <div className={styles.body}>
            <div className={styles.error}>{state.message}</div>
          </div>
        )}
        {state.status === "consent" && <Consent uid={uid} onAccepted={load} onClose={onClose} />}
        {state.status === "ready" && !state.supported && (
          <div className={styles.body}>
            <div className={styles.center}>
              <span className={styles.bigSpark}>✨</span>
              <b>AI can't read this file type yet</b>
              <span className={files.meterText}>It works with PDFs, Word, Excel, PowerPoint, text files and photos up to 20 MB.</span>
            </div>
          </div>
        )}
        {state.status === "ready" && state.supported && tab === "summary" && (
          <SummaryTab uid={uid} item={item} analysis={analysis} left={left} onAnalysis={(a, q) => (setAnalysis(a), setQuota(q))} onAsk={() => setTab("ask")} />
        )}
        {state.status === "ready" && state.supported && tab === "ask" && (
          <AskTab item={item} left={left} suggestions={suggestionsFor(analysis?.docType)} onQuota={setQuota} />
        )}
      </aside>
    </>
  );
}

function Consent({ uid, onAccepted, onClose }: { uid: string; onAccepted: () => void; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className={styles.body}>
      <div className={styles.center}>
        <span className={styles.bigSpark}>✨</span>
        <b style={{ fontSize: 17 }}>Turn on AI for My Space</b>
        <div className={styles.points}>
          <div>
            📄 <b>Only the file you ask about</b> is sent to our AI provider, Google Cloud (Gemini), to read it and answer you.
          </div>
          <div>
            🚫 <b>Never used to train AI.</b> Google doesn't train on files sent this way.
          </div>
          <div>
            🔐 <b>Your Secure Vault is never sent.</b> It stays end-to-end encrypted.
          </div>
          <div>
            ⚙️ You can turn AI off any time in <b>Account</b>.
          </div>
        </div>
        {error && <div className={styles.error}>{error}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button className={files.button} onClick={onClose}>
            Not now
          </button>
          <button
            className={files.primaryButton}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await setAiEnabled(uid, true);
                onAccepted();
              } catch {
                setError("Couldn't turn on AI. Please try again.");
                setBusy(false);
              }
            }}
          >
            {busy ? "Turning on…" : "Turn on AI"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryTab({
  uid,
  item,
  analysis,
  left,
  onAnalysis,
  onAsk,
}: {
  uid: string;
  item: Item;
  analysis: Analysis | null;
  left: number | null;
  onAnalysis: (a: Analysis, q: Quota) => void;
  onAsk: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => listenReminders(uid, (list) => setReminders(list.filter((r) => r.itemId === item.id))), [uid, item.id]);

  const analyse = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await aiAnalyze(item.id);
      onAnalysis(r.analysis, r.quota);
    } catch (e) {
      setError(callError(e).message);
    } finally {
      setBusy(false);
    }
  };

  if (!analysis) {
    return (
      <div className={styles.body}>
        <div className={styles.center}>
          <span className={styles.bigSpark}>✨</span>
          <b style={{ fontSize: 17 }}>Understand this document in seconds</b>
          <span className={files.meterText} style={{ maxWidth: 320 }}>
            Get a short summary, the people and amounts involved, and important dates you can set reminders for.
          </span>
          {error && <div className={styles.error}>{error}</div>}
          <button className={files.primaryButton} onClick={analyse} disabled={busy || left === 0}>
            {busy ? "Reading the document…" : "Summarise this file"}
          </button>
          <span className={files.meterText}>{left === 0 ? "No AI questions left today. They reset at midnight." : "Uses 1 of your daily AI questions."}</span>
        </div>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className={styles.body}>
      <span className={styles.docType}>{analysis.docType}</span>
      <div className={styles.docTitle}>{analysis.title}</div>

      {analysis.summary.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Summary</div>
          <ul className={styles.bullets}>
            {analysis.summary.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {analysis.dates.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Important dates</div>
          {analysis.dates.map((d) => {
            const set = reminders.some((r) => r.date === d.date && r.label === d.label);
            const [y, m, day] = d.date.split("-");
            const past = d.date < today;
            return (
              <div key={`${d.label}-${d.date}`} className={styles.dateRow}>
                <div className={styles.dateBox}>
                  <b>{Number(day)}</b>
                  <span>
                    {MONTHS[Number(m) - 1]} {y.slice(2)}
                  </span>
                </div>
                <div className={styles.dateText}>
                  <div>{d.label}</div>
                  <div>{past ? "Already passed" : d.kind}</div>
                </div>
                {!past &&
                  (set ? (
                    <span className={styles.remindDone}>✓ Reminder set</span>
                  ) : (
                    <button
                      className={styles.remind}
                      disabled={saving === d.date}
                      title="Email me 30, 7 and 1 days before, and on the day"
                      onClick={async () => {
                        setSaving(d.date);
                        try {
                          await addReminder(uid, { itemId: item.id, itemName: item.name, label: d.label, date: d.date });
                        } catch {
                          setError("Couldn't set the reminder. Please try again.");
                        } finally {
                          setSaving(null);
                        }
                      }}
                    >
                      🔔 Remind me
                    </button>
                  ))}
              </div>
            );
          })}
        </div>
      )}

      {analysis.amounts.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Amounts</div>
          <div className={styles.kv}>
            {analysis.amounts.map((a) => (
              <FragmentPair key={`${a.label}-${a.value}`} a={a.label} b={a.value} />
            ))}
          </div>
        </div>
      )}

      {analysis.parties.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>People and organisations</div>
          <div className={styles.chips}>
            {analysis.parties.map((p) => (
              <span key={p} className={styles.chip}>
                {p}
              </span>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className={styles.error} style={{ marginTop: 14 }}>
          {error}
        </div>
      )}
      <div className={styles.section} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className={files.primaryButton} onClick={onAsk}>
          Ask a question
        </button>
        <button className={files.button} onClick={analyse} disabled={busy || left === 0}>
          {busy ? "Re-reading…" : "Summarise again"}
        </button>
      </div>
      <div className={styles.disclaimer}>AI can make mistakes. Check important details in the document itself.</div>
    </div>
  );
}

function FragmentPair({ a, b }: { a: string; b: string }) {
  return (
    <>
      <span>{a}</span>
      <span>{b}</span>
    </>
  );
}

function AskTab({ item, left, suggestions, onQuota }: { item: Item; left: number | null; suggestions: string[]; onQuota: (q: Quota) => void }) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState<string | null>(null);
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  // Braces matter: newer browsers return a Promise from scrollIntoView, which React would treat as a cleanup
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [turns, streaming]);
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    input.current?.focus();
  }, []);

  const busy = streaming !== null;
  const outOfQuestions = left === 0;

  const ask = async (q: string) => {
    const question = q.trim();
    if (!question || busy || outOfQuestions) return;
    setError("");
    setDraft("");
    const history = turns;
    setTurns((t) => [...t, { role: "user", text: question }]);
    setStreaming("");
    abort.current = new AbortController();
    try {
      const r = await aiAsk(item.id, question, history, (chunk) => setStreaming((s) => (s ?? "") + chunk), abort.current.signal);
      setTurns((t) => [...t, { role: "assistant", text: r.text, citations: r.citations }]);
      onQuota(r.quota);
    } catch (e) {
      const err = callError(e);
      if (err.reason === "quota" && err.details) onQuota({ used: Number(err.details.used), limit: Number(err.details.limit) });
      setTurns((t) => t.slice(0, -1));
      setDraft(question);
      setError(err.message);
    } finally {
      setStreaming(null);
    }
  };

  const pages = useMemo(() => (c: ChatTurn["citations"]) => [...new Map((c ?? []).filter((x) => x.page).map((x) => [x.page, x])).values()], []);

  return (
    <>
      <div className={styles.body}>
        {!turns.length && !busy ? (
          <div className={styles.center} style={{ paddingTop: 8 }}>
            <span className={files.meterText}>Ask anything about this document. Try:</span>
            <div className={styles.suggestions}>
              {suggestions.map((s) => (
                <button key={s} className={styles.suggestion} onClick={() => ask(s)} disabled={outOfQuestions}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className={styles.messages} aria-live="polite">
            {turns.map((t, i) =>
              t.role === "user" ? (
                <div key={i} className={styles.user}>
                  {t.text}
                </div>
              ) : (
                <div key={i} className={styles.assistant}>
                  {t.text}
                  {pages(t.citations).length > 0 && (
                    <div className={styles.cites}>
                      {pages(t.citations).map((c) => (
                        <span key={c.page} className={styles.cite} title={`“${c.text}”`}>
                          p. {c.page}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ),
            )}
            {busy &&
              (streaming ? (
                <div className={`${styles.assistant} ${styles.cursor}`}>{streaming}</div>
              ) : (
                <div className={styles.assistant} aria-label="Reading the document">
                  <span className={styles.thinking}>
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
              ))}
          </div>
        )}
        {error && (
          <div className={styles.error} style={{ marginTop: 12 }}>
            {error}
          </div>
        )}
        <div ref={end} />
      </div>
      <div className={styles.foot}>
        <form
          className={styles.composer}
          onSubmit={(e) => {
            e.preventDefault();
            ask(draft);
          }}
        >
          <textarea
            ref={input}
            className={styles.input}
            rows={1}
            value={draft}
            maxLength={1500}
            placeholder={outOfQuestions ? "No AI questions left today" : "Ask about this document…"}
            disabled={outOfQuestions}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(draft);
              }
            }}
            aria-label="Your question"
          />
          <button className={styles.send} type="submit" disabled={busy || !draft.trim() || outOfQuestions} aria-label="Send">
            ↑
          </button>
        </form>
        <div className={styles.disclaimer}>AI can make mistakes. Check important details in the document itself.</div>
      </div>
    </>
  );
}
