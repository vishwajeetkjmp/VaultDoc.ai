"use client";

import Link from "next/link";
import { useStorageAccount } from "../../lib/files/limits";
import site from "../site.module.css";
import styles from "./files.module.css";

/** Account page: which plan this person is on, and what Pro adds. */
export default function PlanSummary({ uid }: { uid: string }) {
  const { plan, planUntil, loading } = useStorageAccount(uid);
  if (loading) return <div className={styles.meterText}>Loading…</div>;
  if (plan === "pro") {
    return (
      <div>
        <b>Pro</b>
        <span className={styles.meterText}>
          {" "}
          · {planUntil ? `until ${planUntil.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}` : "no end date"}
        </span>
        <div className={site.cardText} style={{ marginTop: 4 }}>
          AI across up to 20 files at once, 50 AI questions a day, 10 GB storage and files up to 50 MB.
        </div>
      </div>
    );
  }
  return (
    <div>
      <b>Free</b>
      <div className={site.cardText} style={{ marginTop: 4 }}>
        1 GB storage, files up to 20 MB, 10 AI questions a day about one file at a time.{" "}
        <Link href="/pricing">See what Pro adds</Link>
      </div>
    </div>
  );
}
