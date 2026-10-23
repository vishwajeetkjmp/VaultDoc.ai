import { ToolRegistry } from "./ToolRegistry";
import { FREE_TOOLS } from "./tools";

// Public API of @vaultdocai/core
export * from "./ITool";
export * from "./ToolRegistry";
export * from "./ToolFactory";
export * from "./tools";

/**
 * Default registry with all free tools pre-registered.
 * The web app imports this to render its "Free Tool" dropdown.
 *
 * To add a tool in future: create it in tools.ts and register it here —
 * the UI updates automatically (Open/Closed Principle).
 */
export const defaultToolRegistry = new ToolRegistry();
FREE_TOOLS.forEach((tool) => defaultToolRegistry.register(tool));