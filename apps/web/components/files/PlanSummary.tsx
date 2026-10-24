"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "firebase/auth";
import { collection, onSnapshot, query, Timestamp, where } from "firebase/firestore";
import { db } from "../../lib/files/cloud";
import { useStorageAccount } from "../../lib/files/limits";
import UpgradeButton from "../pricing/UpgradeButton";
import site from "../site.module.css";
import styles from "./files.module.css";

type Payment = { id: string; amount: number; paidAt: Date | null; periodEnd: Date | null; method: string | null };
const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** Account page: the plan, buying or extending Pro, and past payments. */
export default function PlanSummary({ user }: { user: User }) {
  const { plan, planUntil, loading } = useStorageAccount(user.uid);
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(
    () =>
      onSnapshot(
        query(collection(db(), "users", user.uid, "payments"), where("status", "==", "paid")),
        (snap) =>
          setPayments(
            snap.docs
              .map((d) => {
                const x = d.data();
                return {
                  id: d.id,
                  amount: Number(x.amount) || 0,
                  paidAt: x.paidAt instanceof Timestamp ? x.paidAt.toDate() : null,
                  periodEnd: x.periodEnd instanceof Timestamp ? x.periodEnd.toDate() : null,
                  method: typeof x.method === "string" ? x.method : null,
                };
              })
              .sort((a, b) => (b.paidAt?.getTime() ?? 0) - (a.paidAt?.getTime() ?? 0)),
          ),
        () => setPayments([]),
      ),
    [user.uid],
  );

  if (loading) return <div className={styles.meterText}>Loading…</div>;
  return (
    <div>
      {plan === "pro" ? (
        <>
          <b>Pro</b>
          <span className={styles.meterText}> · {planUntil ? `until ${planUntil.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}` : "no end date"}</span>
          <div className={site.cardText} style={{ marginTop: 4 }}>
            AI across up to 20 files at once, 50 AI questions a day, 10 GB storage and files up to 50 MB.
          </div>
        </>
      ) : (
        <>
          <b>Free</b>
          <div className={site.cardText} style={{ marginTop: 4 }}>
            1 GB storage, files up to 20 MB, 10 AI questions a day about one file at a time.{" "}
            <Link href="/pricing">See what Pro adds</Link>
          </div>
        </>
      )}

      <div style={{ marginTop: 14, maxWidth: 320 }}>
        <UpgradeButton user={user} className={styles.primaryButton} noteClassName={styles.meterText} />
      </div>

      {payments.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div className={site.cardText} style={{ fontWeight: 600, marginBottom: 6 }}>
            Payments
          </div>
          {payments.map((p) => (
            <div key={p.id} className={styles.meterText} style={{ display: "flex", gap: 12, flexWrap: "wrap", padding: "4px 0" }}>
              <span>{p.paidAt ? fmt(p.paidAt) : "—"}</span>
              <span>₹{(p.amount / 100).toLocaleString("en-IN")}</span>
              <span>Pro · 30 days{p.periodEnd ? ` (to ${fmt(p.periodEnd)})` : ""}</span>
              {p.method && <span>{p.method.toUpperCase()}</span>}
              <span style={{ opacity: 0.7 }}>{p.id}</span>
            </div>
          ))}
          <div className={styles.meterText} style={{ marginTop: 6 }}>
            Payments aren&apos;t refunded. See the <Link href="/refunds">refund policy</Link>.
          </div>
        </div>
      )}
    </div>
  );
}
