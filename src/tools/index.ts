import type { ToolDefinition, ToolResult } from '../agent/types';
import { ReadTool, GlobTool, GrepTool } from './file';
import { EditTool, WriteTool } from './edit';
import { BashTool } from './bash';

export type ToolExecutor = {
  definition: ToolDefinition;
  execute(input: Record<string, unknown>): Promise<ToolResult>;
};

export class ToolRegistry {
  private tools: Map<string, ToolExecutor> = new Map();
  private bashTool: BashTool;

  constructor(cwd: string) {
    this.bashTool = new BashTool(cwd);

    this.register(new ReadTool(cwd));
    this.register(new GlobTool(cwd));
    this.register(new GrepTool(cwd));
    this.register(new EditTool(cwd));
    this.register(new WriteTool(cwd));
    this.register(this.bashTool);
  }

  private register(tool: ToolExecutor): void {
    this.tools.set(tool.definition.name, tool);
  }

  get(name: string): ToolExecutor | undefined {
    return this.tools.get(name);
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(t => t.definition);
  }

  getOpenAIFormat(): any[] {
    return this.getAll().map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      },
    }));
  }

  getNames(): string[] {
    return Array.from(this.tools.keys());
  }

  getBashTool(): BashTool {
    return this.bashTool;
  }
}

export { ReadTool, GlobTool, GrepTool, EditTool, WriteTool, BashTool };
