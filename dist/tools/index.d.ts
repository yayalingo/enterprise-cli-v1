import type { ToolDefinition, ToolResult } from '../agent/types';
import { ReadTool, GlobTool, GrepTool } from './file';
import { EditTool, WriteTool } from './edit';
import { BashTool } from './bash';
import { WebFetchTool, WebSearchTool } from './web';
import { AgentTool } from './subagent';
import { TaskTool } from './task';
export type ToolExecutor = {
    definition: ToolDefinition;
    execute(input: Record<string, unknown>): Promise<ToolResult>;
};
export declare class ToolRegistry {
    private tools;
    private bashTool;
    private agentTool;
    constructor(cwd: string);
    private register;
    get(name: string): ToolExecutor | undefined;
    getAll(): ToolDefinition[];
    getOpenAIFormat(): any[];
    getNames(): string[];
    getBashTool(): BashTool;
    getAgentTool(): AgentTool;
}
export { ReadTool, GlobTool, GrepTool, EditTool, WriteTool, BashTool, WebFetchTool, WebSearchTool, AgentTool, TaskTool };
//# sourceMappingURL=index.d.ts.map