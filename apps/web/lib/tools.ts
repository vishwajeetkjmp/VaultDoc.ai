import { defaultToolRegistry, ITool } from "@vaultdocai/core";

/**
 * Thin UI helper over the shared core registry.
 * The navbar dropdown renders whatever this returns — add a tool
 * in @vaultdocai/core and it appears here automatically.
 */
export function getFreeTools(): ITool[] {
  return defaultToolRegistry.listByCategory("Free Tool");
}