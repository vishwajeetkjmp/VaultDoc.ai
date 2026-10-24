"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useAuth } from "../AuthProvider";
import { formatRupees, Plan, PLAN_TABS } from "../../lib/plans";
import PlanIcon from "./PlanIcon";
import styles from "./pricing.module.css";

type Billing = "monthly" | "yearly";

// Only logged-in people get the real button (it needs their plan from Firestore)
const UpgradeButton = dynamic(() => import("./UpgradeButton"), { ssr: false });

/** Tabs (Individual / Business), an optional Monthly/Yearly switch, and the plan cards. */
export default function PricingPlans() {
  const [tabId, setTabId] = useState(PLAN_TABS[0].id);
  const [billing, setBilling] = useState<Billing>("yearly");
  const tab = PLAN_TABS.find((t) => t.id === tabId) ?? PLAN_TABS[0];
  const hasYearly = tab.plans.some((p) => p.price?.yearly);

  return (
    <>
      <div className={styles.controls}>
        <div className={styles.segment} role="tablist" aria-label="Plan type">
          {PLAN_TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={t.id === tab.id}
              aria-controls="plans"
              className={t.id === tab.id ? styles.segmentActive : styles.segmentButton}
              onClick={() => setTabId(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {hasYearly && (
          <div className={`${styles.segment} ${styles.segmentSmall}`} role="radiogroup" aria-label="Billing period">
            {(["monthly", "yearly"] as Billing[]).map((b) => (
              <button
                key={b}
                role="radio"
                aria-checked={billing === b}
                className={billing === b ? styles.segmentActive : styles.segmentButton}
                onClick={() => setBilling(b)}
              >
                {b === "monthly" ? "Monthly" : "Yearly"}
                {b === "yearly" && <span className={styles.save}>Save</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* key restarts the card animation when switching tabs */}
      <div id="plans" key={tab.id} className={tab.plans.length === 2 ? styles.gridTwo : styles.grid} role="tabpanel">
        {tab.plans.map((plan) => (
          <PlanCard key={plan.id} plan={plan} billing={billing} />
        ))}
      </div>
    </>
  );
}

function priceText(plan: Plan, billing: Billing): { price: string; note: string } {
  const p = plan.price;
  if (!p) return { price: "Coming soon", note: plan.priceNote ?? "Pricing to be announced" };
  if (p.monthly === 0) return { price: formatRupees(0), note: plan.priceNote ?? "Free forever" };
  if (billing === "yearly" && p.yearly) {
    return {
      price: formatRupees(Math.round(p.yearly / 12)),
      note: `Per month with yearly billing (${formatRupees(p.yearly)} billed up front). ${formatRupees(p.monthly)} if billed monthly.`,
    };
  }
  return { price: formatRupees(p.monthly), note: plan.priceNote ?? "Per month, billed monthly" };
}

function PlanCard({ plan, billing }: { plan: Plan; billing: Billing }) {
  const { price, note } = priceText(plan, billing);
  const { user, loading } = useAuth();
  // Logged-in people already have the free plan, so its button opens My Space instead of sign-up
  const cta = plan.id === "free" && user ? { label: "Go to My Space", href: "/dashboard" } : plan.cta;
  const available = !!cta.href;

  return (
    <article className={plan.highlighted ? styles.cardHighlighted : styles.card} aria-label={`${plan.name} plan`}>
      <div className={styles.icon}>
        <PlanIcon name={plan.icon} />
      </div>
      <div className={styles.nameRow}>
        <h2 className={styles.name}>{plan.name}</h2>
        {plan.badge && <span className={styles.badge}>{plan.badge}</span>}
      </div>
      <p className={styles.tagline}>{plan.tagline}</p>

      <div className={styles.price}>{price}</div>
      <p className={styles.priceNote}>{note}</p>

      {plan.cta.checkout && user ? (
        <UpgradeButton user={user} className={styles.cta} noteClassName={styles.priceNote} />
      ) : available ? (
        // Invisible (but keeping its space) until we know whether someone is logged in, so the label never flips
        <Link href={cta.href!} className={styles.cta} style={{ visibility: loading ? "hidden" : "visible" }}>
          {cta.label}
        </Link>
      ) : (
        <span className={styles.ctaDisabled} aria-disabled>
          {cta.label}
        </span>
      )}

      <div className={styles.divider} />
      {plan.featuresTitle && <div className={styles.featuresTitle}>{plan.featuresTitle}</div>}
      <ul className={styles.features}>
        {plan.features.map((f) => (
          <li key={f}>
            <svg className={styles.check} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m5 12.5 4.5 4.5L19 7.5" />
            </svg>
            {f}
          </li>
        ))}
      </ul>
    </article>
  );
}
