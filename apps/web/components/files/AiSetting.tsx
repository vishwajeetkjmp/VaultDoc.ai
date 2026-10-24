"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { setAiEnabled } from "../../lib/files/ai";
import { db } from "../../lib/files/cloud";
import site from "../site.module.css";

/** Account page: switch AI for My Space on or off (the user's consent). */
export default function AiSetting({ uid }: { uid: string }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => onSnapshot(doc(db(), "users", uid), (s) => setEnabled(s.get("aiEnabled") === true), () => setEnabled(false)), [uid]);

  return (
    <div className={site.card}>
      <label style={{ display: "flex", gap: 14, alignItems: "flex-start", cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={!!enabled}
          disabled={enabled === null || busy}
          onChange={async (e) => {
            setBusy(true);
            setError("");
            try {
              await setAiEnabled(uid, e.target.checked);
            } catch {
              setError("Couldn't save. Please try again.");
            } finally {
              setBusy(false);
            }
          }}
          style={{ width: 18, height: 18, marginTop: 3 }}
        />
        <span>
          <span className={site.cardTitle} style={{ marginTop: 0, display: "block" }}>
            ✨ AI for My Space
          </span>
          <span className={site.cardText} style={{ display: "block", marginTop: 4 }}>
            When on, a file you choose to ask about is sent to Anthropic (Claude) to read it and answer you. It isn&apos;t used to train AI, and the
            Secure Vault is never sent. Turning this off stops all AI use; saved summaries and reminders stay until you delete them.
          </span>
        </span>
      </label>
      {error && (
        <p className={site.cardText} role="alert" style={{ color: "#e5484d" }}>
          {error}
        </p>
      )}
    </div>
  );
}
