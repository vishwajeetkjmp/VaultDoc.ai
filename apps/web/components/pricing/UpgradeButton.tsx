"use client";

import { useState } from "react";
import type { User } from "firebase/auth";
import { callError } from "../../lib/callable";
import { useStorageAccount } from "../../lib/files/limits";
import { buyPro } from "../../lib/payments";
import { formatRupees, PRO_PRICE_RUPEES } from "../../lib/plans";

const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

/**
 * Buy 30 days of Pro (Pricing page and Account). Loaded only for logged-in people, so the
 * Pricing page stays light for visitors. Pro people can add 30 days at any time.
 */
export default function UpgradeButton({ user, className, noteClassName }: { user: User; className?: string; noteClassName?: string }) {
  const { plan, planUntil, loading } = useStorageAccount(user.uid);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null);

  if (!user.emailVerified) {
    return (
      <span className={className} aria-disabled style={{ opacity: 0.6, cursor: "default" }}>
        Verify your email to upgrade
      </span>
    );
  }
  const pro = plan === "pro";
  const unlimited = pro && !planUntil;

  const pay = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const r = await buyPro();
      if (r.status === "paid") setMessage({ text: r.planUntil ? `Payment received. Pro is on until ${fmt(new Date(r.planUntil))}. 🎉` : "Payment received. Pro is on. 🎉" });
    } catch (e) {
      setMessage({ text: e instanceof Error && !("code" in e) ? e.message : callError(e).message, bad: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button className={className} onClick={pay} disabled={busy || loading || unlimited} style={{ visibility: loading ? "hidden" : "visible", width: "100%", cursor: busy ? "progress" : undefined }}>
        {busy ? "Opening payment…" : unlimited ? "You have Pro" : pro ? `Add 30 days · ${formatRupees(PRO_PRICE_RUPEES)}` : `Upgrade to Pro · ${formatRupees(PRO_PRICE_RUPEES)}`}
      </button>
      {(message || (pro && planUntil)) && (
        <p className={noteClassName} role="status" style={{ marginTop: 10, color: message?.bad ? "var(--danger, #e5484d)" : undefined }}>
          {message ? message.text : `You have Pro until ${fmt(planUntil!)}. Paying again adds 30 days.`}
        </p>
      )}
    </>
  );
}
