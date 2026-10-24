"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "../../components/AdminProvider";
import Shell from "../../components/Shell";
import { Card, ReasonDialog, Stat } from "../../components/ui";
import { adminApi, can, errorText, type AiOverview } from "../../lib/api";
import { inr, num } from "../../lib/format";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const whole = (v: string, max: number) => v !== "" && Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= max;

export default function AiPage() {
  const { toast, role } = useAdmin();
  const [d, setD] = useState<AiOverview | null>(null);
  const [editing, setEditing] = useState(false);
  const [perUser, setPerUser] = useState("");
  const [everyone, setEveryone] = useState("");

  const load = useCallback(() => {
    adminApi<AiOverview>("aiOverview")
      .then(setD)
      .catch((e) => toast(errorText(e), true));
  }, [toast]);
  useEffect(load, [load]);

  const openLimits = () => {
    setPerUser(String(d?.limits.defaultDaily ?? 10));
    setEveryone(d?.limits.globalDaily === null || d?.limits.globalDaily === undefined ? "" : String(d.limits.globalDaily));
    setEditing(true);
  };
  const monthName = d ? `${MONTHS[Number(d.month.slice(5)) - 1]} ${d.month.slice(0, 4)}` : "This month";
  const paused = d?.limits.globalDaily === 0;
  const loading = <div className="skeleton" style={{ height: 120 }} />;

  return (
    <Shell
      title="AI"
      actions={
        <button className="btn" onClick={load}>
          Refresh
        </button>
      }
    >
      <div className="grid stats">
        <Stat label="Questions today" value={d ? num(d.today.questions) : "—"} note={d && `${inr(d.today.costMicroUsd)} spent today`} />
        <Stat label={`Questions in ${monthName.split(" ")[0]}`} value={d ? num(d.thisMonth.questions) : "—"} note={d && `${num(d.thisMonth.users)} people used AI`} />
        <Stat label={`Cost in ${monthName.split(" ")[0]}`} value={d ? inr(d.thisMonth.costMicroUsd) : "—"} note="Google Cloud list price, at ₹84 per US$" />
        <Stat
          label="Limits"
          value={d ? (paused ? "AI paused" : `${num(d.limits.defaultDaily)} / user / day`) : "—"}
          note={d && (d.limits.globalDaily === null ? "No cap for everyone together" : paused ? "Cap for everyone is 0" : `Everyone together: ${num(d.limits.globalDaily)} a day`)}
        />
      </div>

      <div className="grid two" style={{ marginTop: 16 }}>
        <Card
          title={`Top AI users · ${monthName}`}
          subtitle="By cost. Click someone to see their account or give them a custom limit."
          flush
        >
          {!d ? (
            <div className="cardBody">{loading}</div>
          ) : !d.topUsers.length ? (
            <div className="empty">Nobody has used AI this month yet.</div>
          ) : (
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th className="num">Questions</th>
                    <th className="num">Cost</th>
                    <th className="num">Tokens</th>
                  </tr>
                </thead>
                <tbody>
                  {d.topUsers.map((u) => (
                    <tr key={u.uid}>
                      <td style={{ maxWidth: 220 }}>
                        {can(role, "support") ? (
                          <Link href={`/users/?uid=${encodeURIComponent(u.uid)}`} className="ellipsis" style={{ display: "block" }}>
                            {u.email}
                          </Link>
                        ) : (
                          <div className="ellipsis">{u.email}</div>
                        )}
                      </td>
                      <td className="num">{num(u.questions)}</td>
                      <td className="num">{inr(u.costMicroUsd)}</td>
                      <td className="num">
                        {num(u.inputTokens + u.outputTokens)}
                        <div className="muted small">{num(u.outputTokens)} out</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card
          title="Limits for everyone"
          subtitle="Custom limits for one person are on their page in Users."
          actions={
            can(role, "owner") && d ? (
              <button className="btn btnSm" onClick={openLimits}>
                Change
              </button>
            ) : undefined
          }
        >
          {!d ? (
            loading
          ) : (
            <dl className="dl">
              <dt>Per user</dt>
              <dd>{d.limits.defaultDaily === 0 ? "No AI (0 a day)" : `${num(d.limits.defaultDaily)} questions a day each`}</dd>
              <dt>Everyone together</dt>
              <dd>
                {d.limits.globalDaily === null ? "No cap" : paused ? <span className="badge warn">AI paused for everyone</span> : `${num(d.limits.globalDaily)} questions a day`}
                {d.limits.globalDaily ? <div className="muted small">{num(d.today.questions)} used today</div> : null}
              </dd>
              <dt>Resets</dt>
              <dd>Midnight, India time</dd>
            </dl>
          )}
          {!can(role, "owner") && <p className="muted small">Only the Owner can change these.</p>}
        </Card>
      </div>

      {editing && d && (
        <ReasonDialog
          title="Change AI limits"
          text="Applies to new questions straight away. People with a custom limit keep theirs."
          confirmLabel="Save limits"
          ready={whole(perUser, 500) && (everyone === "" || whole(everyone, 1_000_000))}
          extra={
            <div style={{ display: "grid", gap: 12 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span className="small" style={{ fontWeight: 600 }}>
                  Questions per user per day <span className="muted">(0 = no AI)</span>
                </span>
                <input className="input" type="number" min={0} max={500} step={1} value={perUser} onChange={(e) => setPerUser(e.target.value)} />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span className="small" style={{ fontWeight: 600 }}>
                  Cap for everyone together per day <span className="muted">(empty = no cap; 0 = pause AI)</span>
                </span>
                <input className="input" type="number" min={0} step={1} value={everyone} onChange={(e) => setEveryone(e.target.value)} />
              </label>
            </div>
          }
          onConfirm={async (reason) => {
            await adminApi("setAiLimits", { reason, defaultDaily: Number(perUser), globalDaily: everyone === "" ? null : Number(everyone) });
            toast("AI limits updated");
            load();
          }}
          onClose={() => setEditing(false)}
        />
      )}
    </Shell>
  );
}
