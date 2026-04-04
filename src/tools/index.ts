import type { ToolDefinition, ToolResult } from '../agent/types';
import { ReadTool, GlobTool, GrepTool } from './file';
import { EditTool, WriteTool } from './edit';
import { BashTool } from './bash';
import { WebFetchTool, WebSearchTool } from './web';
import { AgentTool, ExitWorktreeTool } from './subagent';
import { TaskTool } from './task';

export type ToolExecutor = {
  definition: ToolDefinition;
  execute(input: Record<string, unknown>): Promise<ToolResult>;
};

export class ToolRegistry {
  private tools: Map<string, ToolExecutor> = new Map();
  private bashTool: BashTool;
  private agentTool: AgentTool;

  constructor(cwd: string) {
    this.bashTool = new BashTool(cwd);
    this.agentTool = new AgentTool(cwd);

    this.register(new ReadTool(cwd));
    this.register(new GlobTool(cwd));
    this.register(new GrepTool(cwd));
    this.register(new EditTool(cwd));
    this.register(new WriteTool(cwd));
    this.register(this.bashTool);
    this.register(new WebFetchTool(cwd));
    this.register(new WebSearchTool(cwd));
    this.register(this.agentTool);
    this.register(new ExitWorktreeTool(cwd, this.agentTool));
    this.register(new TaskTool(cwd));
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

  getAgentTool(): AgentTool {
    return this.agentTool;
  }
}

export { ReadTool, GlobTool, GrepTool, EditTool, WriteTool, BashTool, WebFetchTool, WebSearchTool, AgentTool, TaskTool };
