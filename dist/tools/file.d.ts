import type { ToolDefinition, ToolResult } from '../agent/types';
export declare class ReadTool {
    private cwd;
    constructor(cwd: string);
    get definition(): ToolDefinition;
    execute(input: {
        filePath?: string;
        limit?: number;
        offset?: number;
    }): Promise<ToolResult>;
}
export declare class GlobTool {
    private cwd;
    constructor(cwd: string);
    get definition(): ToolDefinition;
    private globMatch;
    private findFiles;
    execute(input: {
        pattern?: string;
        path?: string;
    }): Promise<ToolResult>;
}
export declare class GrepTool {
    private cwd;
    constructor(cwd: string);
    get definition(): ToolDefinition;
    private searchInFile;
    private findFiles;
    execute(input: {
        pattern?: string;
        include?: string;
        path?: string;
        outputMode?: string;
    }): Promise<ToolResult>;
}
//# sourceMappingURL=file.d.ts.map