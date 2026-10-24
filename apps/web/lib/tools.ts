import type { PlanName } from "./plan";
import { defaultToolRegistry, ITool } from "@vaultdocai/core";
import { TOOL_PAGES, ToolAccess } from "./toolPages";

/**
 * Thin UI helper over the shared core registry.
 * The navbar menu renders whatever this returns — add a tool
 * in @vaultdocai/core and it appears here automatically.
 */
export function getFreeTools(): ITool[] {
  return defaultToolRegistry.listByCategory("Free Tool");
}

/** Free tools grouped for menus: [["PDF tools", [...]], ["Image tools", [...]]] */
export function getToolGroups(): [string, ITool[]][] {
  const groups = new Map<string, ITool[]>();
  for (const tool of getFreeTools()) {
    const key = tool.group ?? "Tools";
    groups.set(key, [...(groups.get(key) ?? []), tool]);
  }
  return Array.from(groups);
}

export function getTool(id: string): ITool | undefined {
  return defaultToolRegistry.get(id);
}

/** Who can use a tool (see ToolAccess in toolPages.ts). Tools without a page count as open. */
export function accessOf(tool: ITool): ToolAccess {
  return TOOL_PAGES[tool.id]?.access ?? "open";
}

/** Pro tools get the gold asterisk and the Pro tag wherever they're listed. */
export function needsPro(tool: ITool): boolean {
  return accessOf(tool) === "pro";
}

/**
 * Why a tool can't be opened right now, with the tooltip that says so and where a click should go.
 * Every listing (desktop menu, phone menu, home cards) uses this, so they always agree.
 */
export type ToolLock = {
  kind: "login" | "pro";
  /** Full sentence: desktop hover tooltip and screen readers */
  tip: string;
  /** Short version for small pills (cards, phone menu) */
  short: string;
  href: string;
} | null;

export function toolLock(tool: ITool, loggedIn: boolean, plan: PlanName | null): ToolLock {
  const access = accessOf(tool);
  const login = `/login?next=${encodeURIComponent(tool.route)}`;
  if (access === "pro") {
    if (!loggedIn) return { kind: "login", tip: "A Pro tool. Log in and upgrade to use it", short: "Pro tool · Log in to upgrade", href: login };
    if (plan === "free") return { kind: "pro", tip: `Upgrade to Pro to use ${tool.name}`, short: "Upgrade to Pro", href: "/pricing" };
    return null;
  }
  if (access === "account" && !loggedIn) return { kind: "login", tip: "Log in to use, it's free", short: "Log in to use, it's free", href: login };
  return null;
}

/** A tool is live once the web app has a page for it (see toolPages.ts). */
export function isComingSoon(tool: ITool): boolean {
  return !TOOL_PAGES[tool.id];
}
