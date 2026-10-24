"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAdmin } from "../../components/AdminProvider";
import Shell, { RoleGate } from "../../components/Shell";
import { ReasonDialog, SkeletonRows, SlideOver, UserCell } from "../../components/ui";
import { adminApi, can, errorText, type AiCost, type UserRow } from "../../lib/api";
import { ago, bytes, date, inr, num } from "../../lib/format";

type Filter = "all" | "unverified" | "disabled" | "admins";
type SortKey = "createdAt" | "lastActiveAt" | "usedBytes" | "email";
type Detail = {
  user: UserRow;
  sharesCount: number;
  vaultSetUp: boolean;
  conversionsThisHour: number;
  conversionLimit: number;
  defaultQuotaBytes: number;
  aiEnabled: boolean;
  aiUsedToday: number;
  aiUsage: { today: AiCost; month: AiCost; total: AiCost };
  aiDailyLimit: number | null;
  defaultAiDailyLimit: number;
};
type Op = "disable" | "enable" | "resendVerification" | "setPlan" | "setQuota" | "setAiLimit" | "resetToolLimit" | "stopShares" | "delete";
const planText = (u: UserRow) => (u.plan === "pro" ? `Pro${u.planUntil ? ` until ${date(u.planUntil)}` : " (no end date)"}` : "Free");
/** End of the chosen day, India time (the plan lasts through that whole day) */
const endOfDay = (yyyyMmDd: string) => Date.parse(`${yyyyMmDd}T23:59:59+05:30`);

const provider = (p: string[]) => (p.includes("google.com") ? "Google" : p.includes("password") ? "Email" : p[0] ?? "—");

export default function UsersPage() {
  return (
    <Shell title="Users">
      <RoleGate min="support">
        <Users />
      </RoleGate>
    </Shell>
  );
}

function Users() {
  const { toast } = useAdmin();
  const [rows, setRows] = useState<UserRow[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "createdAt", dir: -1 });
  const [openUid, setOpenUid] = useState<string | null>(null);
  // Opened from another page (AI → top users): /users/?uid=...
  useEffect(() => {
    const uid = new URLSearchParams(window.location.search).get("uid");
    if (uid) setOpenUid(uid);
  }, []);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(
    async (q = "", pageToken?: string) => {
      try {
        const r = await adminApi<{ users: UserRow[]; nextPageToken: string | null }>("listUsers", { query: q, pageToken, pageSize: 200 });
        setRows((prev) => (pageToken && prev ? [...prev, ...r.users] : r.users));
        setNext(r.nextPageToken);
      } catch (e) {
        toast(errorText(e), true);
        setRows((prev) => prev ?? []);
      }
    },
    [toast],
  );
  useEffect(() => void load(), [load]);

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    setRows(null);
    setSearched(query.trim());
    load(query.trim());
  };

  const shown = useMemo(() => {
    const list = (rows ?? []).filter((u) =>
      filter === "unverified" ? !u.verified : filter === "disabled" ? u.disabled : filter === "admins" ? !!u.role : true,
    );
    const { key, dir } = sort;
    return list.sort((a, b) => {
      const va = a[key] ?? (key === "email" ? "" : 0);
      const vb = b[key] ?? (key === "email" ? "" : 0);
      return (typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number)) * dir;
    });
  }, [rows, filter, sort]);

  const th = (label: string, key: SortKey, cls?: string) => (
    <th className={cls} aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
      <button onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : key === "email" ? 1 : -1 }))}>
        {label} {sort.key === key ? (sort.dir === 1 ? "↑" : "↓") : ""}
      </button>
    </th>
  );

  const updateRow = (u: UserRow) => setRows((list) => list?.map((r) => (r.uid === u.uid ? u : r)) ?? list);

  return (
    <section className="card">
      <div className="toolbar">
        <form onSubmit={search} className="row" style={{ flex: 1, minWidth: 260 }}>
          <input className="input" style={{ flex: 1, maxWidth: 380 }} placeholder="Exact email or user ID" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search users" />
          <button className="btn" type="submit">
            Search
          </button>
          {searched && (
            <button
              className="btn btnGhost"
              type="button"
              onClick={() => {
                setQuery("");
                setSearched("");
                setRows(null);
                load();
              }}
            >
              Clear
            </button>
          )}
        </form>
        <select className="select" value={filter} onChange={(e) => setFilter(e.target.value as Filter)} aria-label="Filter">
          <option value="all">All users</option>
          <option value="unverified">Not verified</option>
          <option value="disabled">Disabled</option>
          <option value="admins">Admins</option>
        </select>
      </div>
      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              {th("User", "email")}
              <th className="hideSm">Login</th>
              <th>Status</th>
              {th("Joined", "createdAt", "hideSm")}
              {th("Last active", "lastActiveAt", "hideSm")}
              {th("Storage", "usedBytes", "num")}
            </tr>
          </thead>
          <tbody>
            {!rows ? (
              <SkeletonRows cols={6} />
            ) : !shown.length ? (
              <tr>
                <td colSpan={6} className="empty">
                  {searched ? `No account matches “${searched}”. Search needs the full email or user ID.` : "No users match this filter."}
                </td>
              </tr>
            ) : (
              shown.map((u) => (
                <tr key={u.uid} className="clickable" onClick={() => setOpenUid(u.uid)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setOpenUid(u.uid)}>
                  <td>
                    <UserCell email={u.email} name={u.name} photo={u.photo} />
                  </td>
                  <td className="hideSm">{provider(u.providers)}</td>
                  <td>
                    <div className="row" style={{ gap: 4 }}>
                      {u.disabled ? <span className="badge bad">Disabled</span> : u.verified ? <span className="badge good">Active</span> : <span className="badge warn">Not verified</span>}
                      {u.role && <span className="badge info">{u.role}</span>}
                      {u.plan === "pro" && <span className="badge pro">Pro</span>}
                    </div>
                  </td>
                  <td className="hideSm muted">{date(u.createdAt)}</td>
                  <td className="hideSm muted">{ago(u.lastActiveAt)}</td>
                  <td className="num">
                    {bytes(u.usedBytes)}
                    <div className="muted small">{num(u.fileCount)} files</div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="pager">
        <span className="muted small">{rows ? `${num(shown.length)} shown${rows.length !== shown.length ? ` of ${num(rows.length)} loaded` : ""}` : "Loading…"}</span>
        {next && (
          <button
            className="btn"
            disabled={loadingMore}
            onClick={async () => {
              setLoadingMore(true);
              await load("", next);
              setLoadingMore(false);
            }}
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        )}
      </div>
      {openUid && <UserPanel uid={openUid} onClose={() => setOpenUid(null)} onChanged={updateRow} onDeleted={(uid) => setRows((l) => l?.filter((r) => r.uid !== uid) ?? l)} />}
    </section>
  );
}

function UserPanel({ uid, onClose, onChanged, onDeleted }: { uid: string; onClose: () => void; onChanged: (u: UserRow) => void; onDeleted: (uid: string) => void }) {
  const { role, toast } = useAdmin();
  const [d, setD] = useState<Detail | null>(null);
  const [op, setOp] = useState<Op | null>(null);
  const [quotaGb, setQuotaGb] = useState("");
  const [aiLimit, setAiLimit] = useState("");
  const [plan, setPlan] = useState<"free" | "pro">("pro");
  const [planUntil, setPlanUntil] = useState("");
  // The parent recreates these on every render; refs keep the reload below from re-running because of that
  const callbacks = useRef({ onChanged, onClose });
  callbacks.current = { onChanged, onClose };

  const refresh = useCallback(async () => {
    try {
      const r = await adminApi<Detail>("getUser", { uid });
      setD(r);
      callbacks.current.onChanged(r.user);
    } catch (e) {
      toast(errorText(e), true);
      callbacks.current.onClose();
    }
  }, [uid, toast]);
  useEffect(() => void refresh(), [refresh]);

  const run = async (reason: string) => {
    if (!op) return;
    const r = await adminApi<{ stopped?: number }>("userAction", {
      uid,
      op,
      reason,
      ...(op === "setQuota" ? { quotaGb: quotaGb === "" ? null : Number(quotaGb) } : {}),
      ...(op === "setAiLimit" ? { aiDailyLimit: aiLimit === "" ? null : Number(aiLimit) } : {}),
      ...(op === "setPlan" ? { plan, until: plan === "pro" && planUntil ? endOfDay(planUntil) : null } : {}),
    });
    const done: Record<Op, string> = {
      disable: "Account disabled and signed out everywhere",
      enable: "Account enabled",
      resendVerification: "Verification email sent",
      setPlan: "Plan updated. It applies the next time they open the app",
      setQuota: "Storage quota updated",
      setAiLimit: "AI daily limit updated",
      resetToolLimit: "Conversion limit reset",
      stopShares: `Stopped ${r.stopped ?? 0} shared links`,
      delete: "Account and all its data deleted",
    };
    toast(done[op]);
    if (op === "delete") {
      onDeleted(uid);
      onClose();
    } else await refresh();
  };

  const u = d?.user;
  const quota = u?.quotaBytes ?? d?.defaultQuotaBytes ?? 1;
  const isAdmin = !!u?.role;

  const actions: { op: Op; title: string; text: string; label: string; danger?: boolean; min: "support" | "owner"; show: boolean }[] = u
    ? [
        { op: "resendVerification", title: "Resend verification email", text: "Sends a new verification link to their inbox.", label: "Send", min: "support", show: !u.verified && !u.disabled },
        {
          op: "setPlan",
          title: "Change plan",
          text: `${planText(u)}. Pro: AI across up to 20 files, 50 AI questions a day, 10 GB, files up to 50 MB.`,
          label: "Change plan",
          min: "support",
          show: true,
        },
        { op: "setQuota", title: "Change storage quota", text: `Currently ${bytes(quota)}${u.quotaBytes ? " (custom)" : " (default)"}.`, label: "Save quota", min: "support", show: true },
        {
          op: "setAiLimit",
          title: "Change AI daily limit",
          text: `${d!.aiUsedToday} of ${d!.aiDailyLimit ?? d!.defaultAiDailyLimit} AI questions used today${d!.aiDailyLimit !== null ? " (custom limit)" : ""}.`,
          label: "Change",
          min: "support",
          show: true,
        },
        { op: "resetToolLimit", title: "Reset conversion limit", text: `${d!.conversionsThisHour} of ${d!.conversionLimit} Word conversions used this hour.`, label: "Reset", min: "support", show: d!.conversionsThisHour > 0 },
        { op: "stopShares", title: "Stop all shared links", text: `${d!.sharesCount} active link${d!.sharesCount === 1 ? "" : "s"} will stop working immediately.`, label: "Stop links", danger: true, min: "support", show: d!.sharesCount > 0 },
        u.disabled
          ? { op: "enable", title: "Enable account", text: "They can log in again.", label: "Enable", min: "support", show: true }
          : { op: "disable", title: "Disable account", text: "Signs them out everywhere and blocks logging in. Their files are kept.", label: "Disable", danger: true, min: "support", show: true },
        { op: "delete", title: "Delete account", text: "Permanently deletes the account, all files, the Secure Vault and shared links. This can't be undone.", label: "Delete forever", danger: true, min: "owner", show: true },
      ]
    : [];
  const current = actions.find((a) => a.op === op);

  return (
    <SlideOver title={u ? u.name || u.email : "Loading…"} subtitle={u?.name ? u.email : undefined} onClose={onClose}>
      {!u || !d ? (
        <div className="grid">
          {[80, 60, 70, 50].map((w) => (
            <div key={w} className="skeleton" style={{ height: 14, width: `${w}%` }} />
          ))}
        </div>
      ) : (
        <>
          <div className="row">
            {u.disabled ? <span className="badge bad">Disabled</span> : u.verified ? <span className="badge good">Active</span> : <span className="badge warn">Not verified</span>}
            {u.role && <span className="badge info">Admin: {u.role}</span>}
            {u.plan === "pro" && <span className="badge pro">Pro</span>}
            {d.vaultSetUp && <span className="badge">Secure Vault set up</span>}
          </div>
          <dl className="dl">
            <dt>Plan</dt>
            <dd>{planText(u)}</dd>
            <dt>Login</dt>
            <dd>{provider(u.providers)}</dd>
            <dt>Joined</dt>
            <dd>{date(u.createdAt, true)}</dd>
            <dt>Last active</dt>
            <dd>{ago(u.lastActiveAt)}</dd>
            <dt>Files</dt>
            <dd>{num(u.fileCount)}</dd>
            <dt>Shared links</dt>
            <dd>{num(d.sharesCount)}</dd>
            <dt>AI</dt>
            <dd>
              {d.aiEnabled ? `On · ${d.aiUsedToday} of ${d.aiDailyLimit ?? d.defaultAiDailyLimit} used today${d.aiDailyLimit !== null ? " (custom limit)" : ""}` : "Off"}
              {d.aiUsage.total.questions > 0 && (
                <div className="muted small">
                  Cost: {inr(d.aiUsage.today.costMicroUsd)} today · {inr(d.aiUsage.month.costMicroUsd)} this month ({num(d.aiUsage.month.questions)} question{d.aiUsage.month.questions === 1 ? "" : "s"}) ·{" "}
                  {inr(d.aiUsage.total.costMicroUsd)} in total ({num(d.aiUsage.total.questions)})
                </div>
              )}
            </dd>
            <dt>User ID</dt>
            <dd className="mono ellipsis" title={u.uid}>
              {u.uid}
            </dd>
          </dl>
          <div>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontWeight: 600 }}>Storage</span>
              <span className="muted small">
                {bytes(u.usedBytes)} of {bytes(quota)}
              </span>
            </div>
            <div className="meter" role="meter" aria-valuenow={u.usedBytes} aria-valuemax={quota}>
              <div style={{ width: `${Math.min(100, (u.usedBytes / quota) * 100)}%` }} />
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Actions</div>
            {isAdmin && role !== "owner" ? (
              <p className="muted small">This is an admin account. Only the owner can change it.</p>
            ) : (
              <div className="actions">
                {actions
                  .filter((a) => a.show && can(role, a.min))
                  .map((a) => (
                    <div key={a.op} className="actionRow">
                      <div>
                        <strong>{a.title}</strong>
                        <span className="muted small">{a.text}</span>
                      </div>
                      <button
                        className={`btn btnSm ${a.danger ? "btnDanger" : ""}`}
                        onClick={() => {
                          setQuotaGb(u.quotaBytes ? String(Math.round((u.quotaBytes / 1024 ** 3) * 10) / 10) : "");
                          setAiLimit(d.aiDailyLimit !== null ? String(d.aiDailyLimit) : "");
                          setPlan(u.plan === "pro" ? "free" : "pro"); // the likely change
                          setPlanUntil(u.planUntil ? new Date(u.planUntil + 5.5 * 3_600_000).toISOString().slice(0, 10) : "");
                          setOp(a.op);
                        }}
                      >
                        {a.label}
                      </button>
                    </div>
                  ))}
              </div>
            )}
            <p className="muted small" style={{ marginTop: 10 }}>
              File names and contents are never shown here. Secure Vault files are end-to-end encrypted.
            </p>
          </div>
        </>
      )}
      {current && (
        <ReasonDialog
          title={current.title}
          text={current.text}
          confirmLabel={current.label}
          danger={current.danger}
          ready={
            (op !== "setQuota" || quotaGb === "" || (Number(quotaGb) >= 0.1 && Number(quotaGb) <= 1000)) &&
            (op !== "setAiLimit" || aiLimit === "" || (Number.isInteger(Number(aiLimit)) && Number(aiLimit) >= 0 && Number(aiLimit) <= 500)) &&
            (op !== "setPlan" || plan === "free" || planUntil === "" || endOfDay(planUntil) > Date.now())
          }
          extra={
            op === "setQuota" ? (
              <label style={{ display: "grid", gap: 6 }}>
                <span className="small" style={{ fontWeight: 600 }}>
                  Quota in GB <span className="muted">(empty = default {bytes(d?.defaultQuotaBytes ?? 0)})</span>
                </span>
                <input className="input" type="number" min={0.1} max={1000} step={0.1} value={quotaGb} onChange={(e) => setQuotaGb(e.target.value)} />
              </label>
            ) : op === "setPlan" ? (
              <div style={{ display: "grid", gap: 12 }}>
                <div className="row" role="radiogroup" aria-label="Plan" style={{ gap: 16 }}>
                  {(["free", "pro"] as const).map((p) => (
                    <label key={p} className="row" style={{ gap: 6, cursor: "pointer" }}>
                      <input type="radio" name="plan" checked={plan === p} onChange={() => setPlan(p)} />
                      {p === "pro" ? "Pro" : "Free"}
                    </label>
                  ))}
                </div>
                {plan === "pro" && (
                  <label style={{ display: "grid", gap: 6 }}>
                    <span className="small" style={{ fontWeight: 600 }}>
                      Pro until <span className="muted">(empty = no end date; it ends after this day, India time)</span>
                    </span>
                    <input className="input" type="date" value={planUntil} min={new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10)} onChange={(e) => setPlanUntil(e.target.value)} />
                  </label>
                )}
              </div>
            ) : op === "setAiLimit" ? (
              <label style={{ display: "grid", gap: 6 }}>
                <span className="small" style={{ fontWeight: 600 }}>
                  AI questions per day <span className="muted">(empty = default {d?.defaultAiDailyLimit}; 0 = no AI)</span>
                </span>
                <input className="input" type="number" min={0} max={500} step={1} value={aiLimit} onChange={(e) => setAiLimit(e.target.value)} />
              </label>
            ) : undefined
          }
          onConfirm={run}
          onClose={() => setOp(null)}
        />
      )}
    </SlideOver>
  );
}
