import { defaultToolRegistry, ITool } from "@vaultdocai/core";

/**
 * Thin UI helper over the shared core registry.
 * The navbar dropdown renders whatever this returns — add a tool
 * in @vaultdocai/core and it appears here automatically.
 */
export function getFreeTools(): ITool[] {
  return defaultToolRegistry.listByCategory("Free Tool");
}
export function getTool(id: string): ITool | undefined {
  return defaultToolRegistry.get(id);
}

/** Tools are listed before they're built; one without execution logic yet is "coming soon". */
export function isComingSoon(tool: ITool): boolean {
  return typeof tool.execute !== "function";
}
