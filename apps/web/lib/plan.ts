"use client";

import { useEffect, useState } from "react";
import { onAuthChange } from "./auth";

/**
 * The logged-in person's plan, read from their login token (the `plan` claim the server sets),
 * so the navbar and menus know it without a database read. Updates when the token refreshes,
 * which lib/files/limits.ts triggers as soon as the plan changes.
 *
 * Family, Team and Enterprise don't exist yet; their badge colours are ready for when they do.
 */
export type PlanName = "free" | "pro" | "family" | "team" | "enterprise";

const PAID: PlanName[] = ["pro", "family", "team", "enterprise"];

export const PLAN_LABEL: Record<Exclude<PlanName, "free">, string> = {
  pro: "Pro",
  family: "Family",
  team: "Team",
  enterprise: "Enterprise",
};

/** null until known (logged out, or the token is still loading). */
export function usePlan(): PlanName | null {
  const [plan, setPlan] = useState<PlanName | null>(null);
  useEffect(
    () =>
      onAuthChange(async (user) => {
        if (!user) return setPlan(null);
        const claim = (await user.getIdTokenResult()).claims.plan;
        setPlan(PAID.includes(claim as PlanName) ? (claim as PlanName) : "free");
      }),
    [],
  );
  return plan;
}

/** Paid plans include every Pro tool. */
export const hasProTools = (plan: PlanName | null) => !!plan && plan !== "free";
