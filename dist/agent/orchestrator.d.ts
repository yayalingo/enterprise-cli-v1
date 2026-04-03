import type { Message, LLMInterface, ToolDefinition, PermissionMode } from './types';
import { ToolRegistry } from '../tools';
import { PermissionGate } from '../permissions/gate';
export interface AgentConfig {
    provider: LLMInterface;
    toolRegistry: ToolRegistry;
    permissionGate: PermissionGate;
    cwd: string;
    maxIterations?: number;
}
export declare class AgentOrchestrator {
    private config;
    private messages;
    private claudeMdEntries;
    private sessionContext;
    private contextAssembler;
    private iterationCount;
    private maxIterations;
    constructor(config: AgentConfig);
    initialize(): Promise<void>;
    chat(userInput: string): Promise<string>;
    private buildSystemPrompt;
    private buildUserMessage;
    getToolDefinitions(): ToolDefinition[];
    setPermissionMode(mode: PermissionMode): void;
    getMessages(): Message[];
    getWorkingDirectory(): string;
}
//# sourceMappingURL=orchestrator.d.ts.map