import { PLAN_LABEL, PlanName } from "../lib/plan";
import styles from "./planBadge.module.css";

/** Wraps the avatar: paid plans get a coloured ring and a small plan chip; Free shows the avatar as it is. */
export function PlanAvatar({ plan, children }: { plan: PlanName | null; children: React.ReactNode }) {
  const paid = plan && plan !== "free" ? plan : null;
  return (
    <span className={styles.wrap} data-plan={paid ?? undefined}>
      {children}
      {paid && <span className={styles.chip}>{PLAN_LABEL[paid]}</span>}
    </span>
  );
}

/** "Pro plan" pill for the account card. */
export function PlanPill({ plan }: { plan: PlanName | null }) {
  if (!plan || plan === "free") return null;
  return (
    <span className={styles.wrap} data-plan={plan} style={{ boxShadow: "none", borderRadius: 999 }}>
      <span className={styles.pill}>{PLAN_LABEL[plan]} plan</span>
    </span>
  );
}
