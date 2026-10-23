"use client";

import { useCallback, useEffect, useState } from "react";
import Shell from "../components/Shell";
import TimeChart from "../components/TimeChart";
import { Card, Stat } from "../components/ui";
import { useAdmin } from "../components/AdminProvider";
import { adminApi, errorText, type CurrentStats, type DayStats } from "../lib/api";
import { ago, bytes, num } from "../lib/format";

type Overview = { current: CurrentStats; days: DayStats[] };

/** Last 30 days, filling missing days with 0 so the chart has no gaps. */
function series(days: DayStats[], pick: (d: DayStats) => number | undefined, carry = false) {
  const byDay = new Map(days.map((d) => [d.day, d]));
  const out: { day: string; value: number }[] = [];
  let last = 0;
  for (let i = 29; i >= 0; i--) {
    const day = new Date(Date.now() + 5.5 * 3_600_000 - i * 86_400_000).toISOString().slice(0, 10);
    const v = pick(byDay.get(day) ?? { day });
    if (v !== undefined) last = v;
    out.push({ day, value: v ?? (carry ? last : 0) });
  }
  return out;
}

export default function OverviewPage() {
  const { toast } = useAdmin();
  const [data, setData] = useState<Overview | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (refresh = false) => {
      setRefreshing(refresh);
      try {
        setData(await adminApi<Overview>("overview", { refresh }));
      } catch (e) {
        toast(errorText(e), true);
      } finally {
        setRefreshing(false);
      }
    },
    [toast],
  );
  useEffect(() => void load(), [load]);

  const c = data?.current;
  const days = data?.days ?? [];
  const today = days.find((d) => d.day === new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10));

  return (
    <Shell
      title="Overview"
      actions={
        <>
          {c && <span className="muted small hideSm">Updated {ago(c.at)}</span>}
          <button className="btn" onClick={() => load(true)} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </>
      }
    >
      <div className="grid stats">
        <Stat label="Users" value={c ? num(c.users) : "—"} note={c && `${num(c.verified)} verified · ${num(c.disabled)} disabled`} />
        <Stat label="New sign-ups" value={c ? num(c.newUsers7) : "—"} note={c && `last 7 days · ${num(c.newUsers30)} in 30 days`} />
        <Stat label="Active users" value={c ? num(c.activeUsers7) : "—"} note="used the app in the last 7 days" />
        <Stat label="Storage used" value={c ? bytes(c.storageBytes) : "—"} note={c && `${num(c.files)} files`} />
        <Stat label="Active share links" value={c ? num(c.sharesActive) : "—"} note={today ? `${num(today.shareOpens ?? 0)} opens today` : "opens today: 0"} />
        <Stat label="Word conversions today" value={num(today?.conversions ?? 0)} note="Word and DOC to PDF" />
      </div>

      <div className="grid two" style={{ marginTop: 16 }}>
        <Card title="Sign-ups" subtitle="New accounts per day">
          {data ? <TimeChart points={series(days, (d) => d.signups)} label="Sign-ups per day" format={(n) => num(Math.round(n))} /> : <div className="skeleton" style={{ height: 180 }} />}
        </Card>
        <Card title="Storage" subtitle="Total stored, end of each day">
          {data ? <TimeChart kind="line" points={series(days, (d) => d.storageBytes, true)} label="Total storage" format={bytes} /> : <div className="skeleton" style={{ height: 180 }} />}
        </Card>
        <Card title="Word conversions" subtitle="Word and DOC to PDF per day">
          {data ? <TimeChart points={series(days, (d) => d.conversions)} label="Conversions per day" format={(n) => num(Math.round(n))} /> : <div className="skeleton" style={{ height: 180 }} />}
        </Card>
        <Card title="Shared link opens" subtitle="Views of shared files and folders per day">
          {data ? <TimeChart points={series(days, (d) => d.shareOpens)} label="Share opens per day" format={(n) => num(Math.round(n))} /> : <div className="skeleton" style={{ height: 180 }} />}
        </Card>
      </div>
    </Shell>
  );
}
