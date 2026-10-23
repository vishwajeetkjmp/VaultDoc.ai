"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdmin } from "../../components/AdminProvider";
import Shell, { RoleGate } from "../../components/Shell";
import { SkeletonRows } from "../../components/ui";
import { adminApi, errorText } from "../../lib/api";
import { date } from "../../lib/format";

type Entry = {
  id: string;
  at: number | null;
  actorEmail: string;
  actorRole: string;
  action: string;
  reason: string;
  targetEmail: string | null;
  targetId: string | null;
  details: Record<string, unknown> | null;
};

const LABELS: Record<string, string> = {
  claimOwner: "Became owner",
  "team.setRole": "Set admin role",
  "team.removeRole": "Removed admin role",
  "user.disable": "Disabled account",
  "user.enable": "Enabled account",
  "user.resendVerification": "Resent verification",
  "user.setQuota": "Changed quota",
  "user.resetToolLimit": "Reset conversion limit",
  "user.stopShares": "Stopped user's links",
  "user.delete": "Deleted account",
  "share.stop": "Stopped a link",
};
const danger = (a: string) => ["user.delete", "user.disable", "user.stopShares", "share.stop", "team.removeRole"].includes(a);

export default function AuditPage() {
  return (
    <Shell title="Audit log">
      <RoleGate min="support">
        <Audit />
      </RoleGate>
    </Shell>
  );
}

function Audit() {
  const { toast } = useAdmin();
  const [rows, setRows] = useState<Entry[] | null>(null);
  const [more, setMore] = useState(false);
  const [q, setQ] = useState("");
  const [action, setAction] = useState("");

  const load = useCallback(
    async (after?: number) => {
      try {
        const r = await adminApi<{ entries: Entry[] }>("audit", after ? { after } : {});
        setRows((prev) => (after && prev ? [...prev, ...r.entries] : r.entries));
        setMore(r.entries.length === 100);
      } catch (e) {
        toast(errorText(e), true);
        setRows((p) => p ?? []);
      }
    },
    [toast],
  );
  useEffect(() => void load(), [load]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (rows ?? []).filter(
      (e) => (!action || e.action === action) && (!t || [e.actorEmail, e.targetEmail, e.reason].some((v) => v?.toLowerCase().includes(t))),
    );
  }, [rows, q, action]);

  return (
    <section className="card">
      <div className="toolbar">
        <input className="input" style={{ flex: 1, maxWidth: 360 }} placeholder="Filter by admin, user or reason" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter" />
        <select className="select" value={action} onChange={(e) => setAction(e.target.value)} aria-label="Action">
          <option value="">All actions</option>
          {Object.entries(LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <span className="spacer" />
        <span className="muted small">Entries can't be edited or deleted.</span>
      </div>
      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Admin</th>
              <th>Action</th>
              <th>Target</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {!rows ? (
              <SkeletonRows cols={5} />
            ) : !shown.length ? (
              <tr>
                <td colSpan={5} className="empty">
                  No matching entries.
                </td>
              </tr>
            ) : (
              shown.map((e) => (
                <tr key={e.id}>
                  <td className="muted" style={{ whiteSpace: "nowrap" }}>
                    {date(e.at, true)}
                  </td>
                  <td>
                    <div className="ellipsis">{e.actorEmail}</div>
                    <div className="muted small">{e.actorRole}</div>
                  </td>
                  <td>
                    <span className={`badge ${danger(e.action) ? "bad" : "info"}`}>{LABELS[e.action] ?? e.action}</span>
                    {e.details && Object.keys(e.details).length > 0 && (
                      <div className="muted small mono" style={{ marginTop: 4 }}>
                        {Object.entries(e.details)
                          .map(([k, v]) => `${k}: ${v ?? "default"}`)
                          .join(", ")}
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="ellipsis">{e.targetEmail ?? "—"}</div>
                  </td>
                  <td style={{ maxWidth: 320 }}>{e.reason}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {more && rows && (
        <div className="pager">
          <span className="muted small">{rows.length} loaded</span>
          <button className="btn" onClick={() => load(rows[rows.length - 1]?.at ?? undefined)}>
            Load older
          </button>
        </div>
      )}
    </section>
  );
}
