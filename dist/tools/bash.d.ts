import type { ToolDefinition, ToolResult } from '../agent/types';
export declare class BashTool {
    private cwd;
    private workingDir;
    constructor(cwd: string);
    get definition(): ToolDefinition;
    getWorkingDirectory(): string;
    execute(input: {
        command?: string;
        description?: string;
        timeout?: number;
    }): Promise<ToolResult>;
}
//# sourceMappingURL=bash.d.ts.map