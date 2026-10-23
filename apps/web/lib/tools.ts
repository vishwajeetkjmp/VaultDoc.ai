import { defaultToolRegistry, ITool } from "@vaultdocai/core";
import { TOOL_PAGES } from "./toolPages";

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

/** A tool is live once the web app has a page for it (see toolPages.ts). */
export function isComingSoon(tool: ITool): boolean {
  return !TOOL_PAGES[tool.id];
}
