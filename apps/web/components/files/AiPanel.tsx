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
  CombinedAnalysis,
  listenReminders,
  Quota,
  Reminder,
  setAiEnabled,
} from "../../lib/files/ai";
import type { Item } from "../../lib/files/items";
import files from "./files.module.css";
import styles from "./ai.module.css";

type Tab = "summary" | "ask";
type State =
  | { status: "loading" }
  | { status: "consent" }
  | { status: "pro" }
  | { status: "ready"; supported: boolean }
  | { status: "error"; message: string };

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

/** Suggested questions across several files (Pro). */
const MULTI_SUGGESTIONS = [
  "List every important date and deadline across these files",
  "What is the total of all amounts, file by file?",
  "What differs between these documents?",
  "Is there anything I need to do soon?",
];

/**
 * Slide-in AI panel for one file, or several files together (Pro): Summary (key details + reminders)
 * and Ask (chat with page references).
 */
export default function AiPanel({ uid, items, onClose }: { uid: string; items: Item[]; onClose: () => void }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [tab, setTab] = useState<Tab>("summary");
  const [quota, setQuota] = useState<Quota | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [combined, setCombined] = useState<CombinedAnalysis | null>(null);
  const multi = items.length > 1;
  const idsKey = items.map((i) => i.id).join(",");
  const ids = useMemo(() => idsKey.split(","), [idsKey]);

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const r = await aiInfo(ids);
      setQuota(r.quota);
      setAnalysis(r.analysis);
      setCombined(r.combined);
      setState({ status: "ready", supported: r.supported });
      setTab("summary");
    } catch (e) {
      const err = callError(e);
      setState(err.reason === "consent" ? { status: "consent" } : err.reason === "pro" ? { status: "pro" } : { status: "error", message: err.message });
    }
  }, [ids]);
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
      <aside className={styles.panel} role="dialog" aria-modal aria-label={multi ? `Ask AI about ${items.length} files` : `Ask AI about ${items[0].name}`}>
        <div className={styles.head}>
          <span className={styles.spark} aria-hidden>
            ✨
          </span>
          <div className={styles.headText}>
            <div className={styles.headTitle}>
              Ask AI{multi && <span className={styles.proTag}>Pro</span>}
            </div>
            <div className={styles.headFile} title={items.map((i) => i.name).join("\n")}>
              {multi ? `${items.length} files` : items[0].name}
            </div>
          </div>
          <button className={styles.close} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {multi && (
          <div className={styles.fileChips}>
            {items.map((i) => (
              <span key={i.id} className={styles.fileChip} title={i.name}>
                📄 {i.name}
              </span>
            ))}
          </div>
        )}

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
        {state.status === "pro" && <ProNeeded onClose={onClose} />}
        {state.status === "ready" && !state.supported && (
          <div className={styles.body}>
            <div className={styles.center}>
              <span className={styles.bigSpark}>✨</span>
              <b>{multi ? "AI can't read all of these files" : "AI can't read this file type yet"}</b>
              <span className={files.meterText}>
                It works with PDFs, Word, Excel, PowerPoint, text files and photos up to 20 MB{multi ? " each, 50 MB together" : ""}.
              </span>
            </div>
          </div>
        )}
        {state.status === "ready" && state.supported && tab === "summary" && (
          <SummaryTab
            uid={uid}
            items={items}
            analysis={analysis}
            combined={combined}
            left={left}
            onDone={(r) => {
              if (r.analysis) setAnalysis(r.analysis);
              if (r.combined) setCombined(r.combined);
              setQuota(r.quota);
            }}
            onAsk={() => setTab("ask")}
          />
        )}
        {state.status === "ready" && state.supported && tab === "ask" && (
          <AskTab ids={ids} multi={multi} left={left} suggestions={multi ? MULTI_SUGGESTIONS : suggestionsFor(analysis?.docType)} onQuota={setQuota} />
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
            📄 <b>Only the files you ask about</b> are sent to our AI provider, Google Cloud (Gemini), to read them and answer you.
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

/** A Free user chose several files: explain Pro instead of an error. */
function ProNeeded({ onClose }: { onClose: () => void }) {
  return (
    <div className={styles.body}>
      <div className={styles.center}>
        <span className={styles.bigSpark}>👑</span>
        <b style={{ fontSize: 17 }}>Ask about several files together with Pro</b>
        <span className={files.meterText} style={{ maxWidth: 340 }}>
          On the Free plan, AI reads one file at a time. Choose one file, or see what Pro adds.
        </span>
        <div className={styles.points}>
          <div>📚 Up to 20 files in one question: compare, total, find every deadline</div>
          <div>✨ 50 AI questions a day</div>
          <div>☁️ 10 GB storage, files up to 50 MB</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className={files.button} onClick={onClose}>
            Choose one file
          </button>
          <a className={files.primaryButton} href="/pricing" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
            See Pro
          </a>
        </div>
      </div>
    </div>
  );
}

function SummaryTab({
  uid,
  items,
  analysis,
  combined,
  left,
  onDone,
  onAsk,
}: {
  uid: string;
  items: Item[];
  analysis: Analysis | null;
  combined: CombinedAnalysis | null;
  left: number | null;
  onDone: (r: { analysis?: Analysis; combined?: CombinedAnalysis; quota: Quota }) => void;
  onAsk: () => void;
}) {
  const multi = items.length > 1;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const idsKey = items.map((i) => i.id).join(",");

  useEffect(() => {
    const ids = new Set(idsKey.split(","));
    return listenReminders(uid, (list) => setReminders(list.filter((r) => ids.has(r.itemId))));
  }, [uid, idsKey]);

  const analyse = async () => {
    setBusy(true);
    setError("");
    try {
      onDone(await aiAnalyze(items.map((i) => i.id)));
    } catch (e) {
      setError(callError(e).message);
    } finally {
      setBusy(false);
    }
  };

  if (multi ? !combined : !analysis) {
    return (
      <div className={styles.body}>
        <div className={styles.center}>
          <span className={styles.bigSpark}>✨</span>
          <b style={{ fontSize: 17 }}>{multi ? `Understand these ${items.length} files in seconds` : "Understand this document in seconds"}</b>
          <span className={files.meterText} style={{ maxWidth: 320 }}>
            {multi
              ? "Get an overview of the set, then each file's summary, amounts and important dates you can set reminders for."
              : "Get a short summary, the people and amounts involved, and important dates you can set reminders for."}
          </span>
          {error && <div className={styles.error}>{error}</div>}
          <button className={files.primaryButton} onClick={analyse} disabled={busy || left === 0}>
            {busy ? (multi ? "Reading the files…" : "Reading the document…") : multi ? "Summarise these files" : "Summarise this file"}
          </button>
          <span className={files.meterText}>{left === 0 ? "No AI questions left today. They reset at midnight." : "Uses 1 of your daily AI questions."}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.body}>
      {multi && combined ? (
        <>
          {combined.overview.length > 0 && (
            <div>
              <div className={styles.sectionTitle}>Overview</div>
              <ul className={styles.bullets}>
                {combined.overview.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {combined.documents.map((d) => (
            <section key={d.itemId} className={styles.docCard}>
              <div className={styles.docFile} title={d.file}>
                📄 {d.file}
              </div>
              <DocumentFacts uid={uid} a={d} itemId={d.itemId} itemName={d.file} reminders={reminders} onError={setError} compact />
            </section>
          ))}
        </>
      ) : (
        analysis && <DocumentFacts uid={uid} a={analysis} itemId={items[0].id} itemName={items[0].name} reminders={reminders} onError={setError} />
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

/** One document's key facts: type and title, summary, dates (with Remind me), amounts, people. */
function DocumentFacts({
  uid,
  a,
  itemId,
  itemName,
  reminders,
  onError,
  compact,
}: {
  uid: string;
  a: Analysis;
  itemId: string;
  itemName: string;
  reminders: Reminder[];
  onError: (message: string) => void;
  compact?: boolean;
}) {
  const [saving, setSaving] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const section = compact ? styles.sectionCompact : styles.section;
  return (
    <>
      <span className={styles.docType}>{a.docType}</span>
      <div className={compact ? styles.docTitleSmall : styles.docTitle}>{a.title}</div>

      {a.summary.length > 0 && (
        <div className={section}>
          {!compact && <div className={styles.sectionTitle}>Summary</div>}
          <ul className={styles.bullets}>
            {a.summary.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {a.dates.length > 0 && (
        <div className={section}>
          <div className={styles.sectionTitle}>Important dates</div>
          {a.dates.map((d) => {
            const set = reminders.some((r) => r.itemId === itemId && r.date === d.date && r.label === d.label);
            const [y, m, day] = d.date.split("-");
            const past = d.date < today;
            const key = `${d.label}-${d.date}`;
            return (
              <div key={key} className={styles.dateRow}>
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
                      disabled={saving === key}
                      title="Email me 30, 7 and 1 days before, and on the day"
                      onClick={async () => {
                        setSaving(key);
                        try {
                          await addReminder(uid, { itemId, itemName, label: d.label, date: d.date });
                        } catch {
                          onError("Couldn't set the reminder. Please try again.");
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

      {a.amounts.length > 0 && (
        <div className={section}>
          <div className={styles.sectionTitle}>Amounts</div>
          <div className={styles.kv}>
            {a.amounts.map((x) => (
              <FragmentPair key={`${x.label}-${x.value}`} a={x.label} b={x.value} />
            ))}
          </div>
        </div>
      )}

      {a.parties.length > 0 && (
        <div className={section}>
          <div className={styles.sectionTitle}>People and organisations</div>
          <div className={styles.chips}>
            {a.parties.map((p) => (
              <span key={p} className={styles.chip}>
                {p}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
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

function AskTab({ ids, multi, left, suggestions, onQuota }: { ids: string[]; multi: boolean; left: number | null; suggestions: string[]; onQuota: (q: Quota) => void }) {
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
      const r = await aiAsk(ids, question, history, (chunk) => setStreaming((s) => (s ?? "") + chunk), abort.current.signal);
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
            <span className={files.meterText}>{multi ? `Ask anything about these ${ids.length} files. Try:` : "Ask anything about this document. Try:"}</span>
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
                <div className={styles.assistant} aria-label={multi ? "Reading the files" : "Reading the document"}>
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
            placeholder={outOfQuestions ? "No AI questions left today" : multi ? "Ask about these files…" : "Ask about this document…"}
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
