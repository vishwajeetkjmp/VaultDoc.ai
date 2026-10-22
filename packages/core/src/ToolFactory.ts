import { ITool } from "./ITool";
import { ToolRegistry } from "./ToolRegistry";

/**
 * ToolFactory (Factory pattern) — resolve a tool by id from a registry.
 * Depends on the ToolRegistry abstraction, not concrete tool classes.
 */
export class ToolFactory {
  constructor(private readonly registry: ToolRegistry) {}

  create(id: string): ITool | undefined {
    return this.registry.get(id);
  }
}