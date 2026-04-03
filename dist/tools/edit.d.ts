import type { ToolDefinition, ToolResult } from '../agent/types';
export declare class EditTool {
    private cwd;
    constructor(cwd: string);
    get definition(): ToolDefinition;
    execute(input: {
        filePath?: string;
        oldString?: string;
        newString?: string;
    }): Promise<ToolResult>;
}
export declare class WriteTool {
    private cwd;
    constructor(cwd: string);
    get definition(): ToolDefinition;
    execute(input: {
        filePath?: string;
        content?: string;
    }): Promise<ToolResult>;
}
//# sourceMappingURL=edit.d.ts.map