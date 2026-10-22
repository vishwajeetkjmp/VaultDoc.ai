import { ITool } from "./ITool";

/**
 * ToolRegistry (Registry pattern) — single source of truth for tools.
 * The UI renders its menus FROM this registry, proving easy extensibility:
 * register a new tool and it appears automatically, no UI changes needed.
 */
export class ToolRegistry {
  private tools = new Map<string, ITool>();

  register(tool: ITool): void {
    if (this.tools.has(tool.id)) {
      throw new Error(`Tool with id "${tool.id}" is already registered.`);
    }
    this.tools.set(tool.id, tool);
  }

  get(id: string): ITool | undefined {
    return this.tools.get(id);
  }

  list(): ITool[] {
    return Array.from(this.tools.values());
  }

  listByCategory(category: string): ITool[] {
    return this.list().filter((t) => t.category === category);
  }
}