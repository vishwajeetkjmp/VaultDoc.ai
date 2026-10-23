"use client";

import { useEffect, useState } from "react";
import { useAdmin } from "../../components/AdminProvider";
import Shell, { RoleGate } from "../../components/Shell";
import { Card } from "../../components/ui";
import { adminApi, errorText } from "../../lib/api";
import { bytes, num } from "../../lib/format";

type Abuse = {
  topStorage: { uid: string; email: string; usedBytes: number; fileCount: number }[];
  limitHits: { uid: string | null; email: string; kind: string; count: number }[];
  mostOpened: { linkId: string; ownerEmail: string; mode: string; views: number; downloads: number }[];
};

export default function AbusePage() {
  return (
    <Shell title="Abuse">
      <RoleGate min="support">
        <AbuseView />
      </RoleGate>
    </Shell>
  );
}

function AbuseView() {
  const { toast } = useAdmin();
  const [d, setD] = useState<Abuse | null>(null);
  useEffect(() => {
    adminApi<Abuse>("abuse")
      .then(setD)
      .catch((e) => toast(errorText(e), true));
  }, [toast]);

  const max = Math.max(1, ...(d?.topStorage.map((u) => u.usedBytes) ?? [1]));
  const loading = <div className="skeleton" style={{ height: 120 }} />;

  return (
    <div className="grid two">
      <Card title="Biggest storage users" subtitle="Top 15 by space used" flush>
        {!d ? (
          <div className="cardBody">{loading}</div>
        ) : !d.topStorage.length ? (
          <div className="empty">No files stored yet.</div>
        ) : (
          <table>
            <tbody>
              {d.topStorage.map((u) => (
                <tr key={u.uid}>
                  <td style={{ width: "45%" }}>
                    <div className="ellipsis">{u.email}</div>
                  </td>
                  <td>
                    <div className="meter" title={bytes(u.usedBytes)}>
                      <div style={{ width: `${(u.usedBytes / max) * 100}%` }} />
                    </div>
                  </td>
                  <td className="num">
                    {bytes(u.usedBytes)}
                    <div className="muted small">{num(u.fileCount)} files</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <div className="grid">
        <Card title="Hitting limits right now" subtitle="Word conversions (10/hour) and invite emails (100/day)" flush>
          {!d ? (
            <div className="cardBody">{loading}</div>
          ) : !d.limitHits.length ? (
            <div className="empty">Nobody is at a limit. 👍</div>
          ) : (
            <table>
              <tbody>
                {d.limitHits.map((h, i) => (
                  <tr key={i}>
                    <td>
                      <div className="ellipsis">{h.email}</div>
                    </td>
                    <td>
                      <span className="badge warn">{h.kind === "mail" ? "Invite emails" : "Conversions"}</span>
                    </td>
                    <td className="num">{num(h.count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card title="Most-opened shared links" subtitle="A sudden spike can mean a link was posted publicly" flush>
          {!d ? (
            <div className="cardBody">{loading}</div>
          ) : !d.mostOpened.length ? (
            <div className="empty">No shared links yet.</div>
          ) : (
            <table>
              <tbody>
                {d.mostOpened.map((s) => (
                  <tr key={s.linkId}>
                    <td>
                      <div className="ellipsis">{s.ownerEmail}</div>
                      <div className="muted small">{s.mode === "link" ? "Anyone with link" : "Invite only"}</div>
                    </td>
                    <td className="num">
                      {num(s.views)} views
                      <div className="muted small">{num(s.downloads)} downloads</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
