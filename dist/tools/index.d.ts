import type { ToolDefinition, ToolResult } from '../agent/types';
import { ReadTool, GlobTool, GrepTool } from './file';
import { EditTool, WriteTool } from './edit';
import { BashTool } from './bash';
export type ToolExecutor = {
    definition: ToolDefinition;
    execute(input: Record<string, unknown>): Promise<ToolResult>;
};
export declare class ToolRegistry {
    private tools;
    private bashTool;
    constructor(cwd: string);
    private register;
    get(name: string): ToolExecutor | undefined;
    getAll(): ToolDefinition[];
    getOpenAIFormat(): any[];
    getNames(): string[];
    getBashTool(): BashTool;
}
export { ReadTool, GlobTool, GrepTool, EditTool, WriteTool, BashTool };
//# sourceMappingURL=index.d.ts.map