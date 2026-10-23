"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "../../components/AdminProvider";
import Shell, { RoleGate } from "../../components/Shell";
import { ReasonDialog, SkeletonRows } from "../../components/ui";
import { adminApi, errorText } from "../../lib/api";
import { ago, date, num } from "../../lib/format";

type ShareRow = {
  linkId: string;
  ownerUid: string;
  ownerEmail: string;
  itemKind: "file" | "folder";
  mode: "link" | "invite";
  inviteeCount: number;
  expiresAt: number | null;
  views: number;
  downloads: number;
  lastOpenedAt: number | null;
  createdAt: number | null;
};

export default function SharesPage() {
  return (
    <Shell title="Shares">
      <RoleGate min="support">
        <Shares />
      </RoleGate>
    </Shell>
  );
}

function Shares() {
  const { toast } = useAdmin();
  const [rows, setRows] = useState<ShareRow[] | null>(null);
  const [more, setMore] = useState(false);
  const [stop, setStop] = useState<ShareRow | null>(null);

  const load = useCallback(
    async (after?: number) => {
      try {
        const r = await adminApi<{ shares: ShareRow[] }>("listShares", after ? { after } : {});
        setRows((prev) => (after && prev ? [...prev, ...r.shares] : r.shares));
        setMore(r.shares.length === 50);
      } catch (e) {
        toast(errorText(e), true);
        setRows((p) => p ?? []);
      }
    },
    [toast],
  );
  useEffect(() => void load(), [load]);

  const expiry = (s: ShareRow) =>
    !s.expiresAt ? <span className="muted">Never</span> : s.expiresAt < Date.now() ? <span className="badge warn">Expired</span> : date(s.expiresAt);

  return (
    <section className="card">
      <div className="toolbar">
        <span className="muted">Shared links, newest first. File names are hidden for privacy; open the owner in Users for account actions.</span>
      </div>
      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Owner</th>
              <th>Type</th>
              <th>Access</th>
              <th className="num">Views</th>
              <th className="num">Downloads</th>
              <th className="hideSm">Last opened</th>
              <th className="hideSm">Expires</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {!rows ? (
              <SkeletonRows cols={8} />
            ) : !rows.length ? (
              <tr>
                <td colSpan={8} className="empty">
                  No shared links yet.
                </td>
              </tr>
            ) : (
              rows.map((s) => (
                <tr key={s.linkId}>
                  <td>
                    <div className="ellipsis" style={{ fontWeight: 550 }}>
                      {s.ownerEmail}
                    </div>
                    <div className="muted small">Shared {date(s.createdAt)}</div>
                  </td>
                  <td>{s.itemKind === "folder" ? "Folder" : "File"}</td>
                  <td>{s.mode === "link" ? <span className="badge">Anyone with link</span> : <span className="badge info">{s.inviteeCount} invited</span>}</td>
                  <td className="num">{num(s.views)}</td>
                  <td className="num">{num(s.downloads)}</td>
                  <td className="hideSm muted">{ago(s.lastOpenedAt)}</td>
                  <td className="hideSm">{expiry(s)}</td>
                  <td className="num">
                    <button className="btn btnSm btnDanger" onClick={() => setStop(s)}>
                      Stop
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {more && rows && (
        <div className="pager">
          <span className="muted small">{num(rows.length)} loaded</span>
          <button className="btn" onClick={() => load(rows[rows.length - 1]?.createdAt ?? undefined)}>
            Load more
          </button>
        </div>
      )}
      {stop && (
        <ReasonDialog
          title="Stop this shared link?"
          text={`The link from ${stop.ownerEmail} stops working immediately for everyone. The file itself isn't touched.`}
          confirmLabel="Stop link"
          danger
          onConfirm={async (reason) => {
            await adminApi("stopShare", { linkId: stop.linkId, reason });
            setRows((l) => l?.filter((r) => r.linkId !== stop.linkId) ?? l);
            toast("Link stopped");
          }}
          onClose={() => setStop(null)}
        />
      )}
    </section>
  );
}
