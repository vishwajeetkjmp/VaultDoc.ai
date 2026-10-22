/**
 * ITool — the abstraction every tool must implement (Dependency Inversion).
 *
 * To add a new tool later:
 *   1. Create an object/class that implements ITool.
 *   2. Register it in the ToolRegistry.
 * No existing code needs to change (Open/Closed Principle).
 */

export interface ToolResult {
  success: boolean;
  message?: string;
  data?: unknown;
}

export interface ITool {
  /** Unique, stable identifier (e.g. "convert-to-pdf"). */
  id: string;
  /** Human-readable name shown in the UI. */
  name: string;
  /** Grouping category, e.g. "Free Tool". */
  category: string;
  /** Route the tool lives at. */
  route: string;
  /** Optional icon key. */
  icon?: string;
  /** Optional execution logic (added in later phases). */
  execute?(input: unknown): Promise<ToolResult>;
}