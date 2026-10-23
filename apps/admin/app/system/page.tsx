"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "../../components/AdminProvider";
import Shell from "../../components/Shell";
import { Card } from "../../components/ui";
import { adminApi, errorText } from "../../lib/api";
import { ago } from "../../lib/format";

type Check = { ok: boolean; ms?: number; detail?: string };
type Health = { checks: Record<"firestore" | "storage" | "auth" | "converter" | "email", Check>; statsUpdatedAt: number | null; project: string | null; region: string };

const NAMES: Record<keyof Health["checks"], [string, string]> = {
  firestore: ["Database", "Firestore: files, shares, settings"],
  storage: ["File storage", "Cloud Storage bucket"],
  auth: ["Logins", "Firebase Authentication"],
  converter: ["Word converter", "Private Cloud Run service (LibreOffice)"],
  email: ["Email sending", "Resend: share invites, verification"],
};

export default function SystemPage() {
  const { toast } = useAdmin();
  const [h, setH] = useState<Health | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async () => {
    setBusy(true);
    try {
      setH(await adminApi<Health>("health"));
    } catch (e) {
      toast(errorText(e), true);
    } finally {
      setBusy(false);
    }
  }, [toast]);
  useEffect(() => void run(), [run]);

  const project = h?.project ?? "";
  const links = [
    ["Error Reporting", `https://console.cloud.google.com/errors?project=${project}`, "Crashes from the website and functions, grouped"],
    ["Logs", `https://console.cloud.google.com/logs/query?project=${project}`, "Everything the functions log"],
    ["Monitoring and alerts", `https://console.cloud.google.com/monitoring/alerting?project=${project}`, "Uptime checks and email alerts"],
    ["Cloud Run", `https://console.cloud.google.com/run?project=${project}`, "Functions and the Word converter"],
    ["Billing", `https://console.cloud.google.com/billing?project=${project}`, "Costs and budget alerts"],
    ["Firebase console", `https://console.firebase.google.com/project/${project}/overview`, "Database, storage, logins"],
  ];

  return (
    <Shell
      title="System"
      actions={
        <button className="btn" onClick={run} disabled={busy}>
          {busy ? "Checking…" : "Run checks"}
        </button>
      }
    >
      <div className="grid two">
        <Card title="Live checks" subtitle={h ? `Project ${h.project} · ${h.region}` : "Checking…"} flush>
          <table>
            <tbody>
              {(Object.keys(NAMES) as (keyof Health["checks"])[]).map((k) => {
                const c = h?.checks[k];
                return (
                  <tr key={k}>
                    <td>
                      <div style={{ fontWeight: 550 }}>{NAMES[k][0]}</div>
                      <div className="muted small">{c?.detail ?? NAMES[k][1]}</div>
                    </td>
                    <td className="num">
                      {!c ? (
                        <span className="skeleton" style={{ display: "inline-block", width: 60, height: 12 }} />
                      ) : (
                        <>
                          <span className={`badge ${c.ok ? "good" : "bad"}`}>{c.ok ? "✓ OK" : "✕ Problem"}</span>
                          {c.ms !== undefined && <div className="muted small">{c.ms} ms</div>}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td>
                  <div style={{ fontWeight: 550 }}>Overview numbers</div>
                  <div className="muted small">Recalculated every hour</div>
                </td>
                <td className="num">
                  {h && (
                    <span className={`badge ${h.statsUpdatedAt && Date.now() - h.statsUpdatedAt < 2 * 3_600_000 ? "good" : "warn"}`}>{h.statsUpdatedAt ? ago(h.statsUpdatedAt) : "Not yet"}</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
        <Card title="Monitoring" subtitle="Google Cloud tools (open in a new tab)" flush>
          <table>
            <tbody>
              {links.map(([label, href, text]) => (
                <tr key={label}>
                  <td>
                    <a href={href} target="_blank" rel="noreferrer" style={{ fontWeight: 550, color: "var(--primary)" }}>
                      {label} ↗
                    </a>
                    <div className="muted small">{text}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </Shell>
  );
}
