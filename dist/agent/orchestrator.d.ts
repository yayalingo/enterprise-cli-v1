import type { Message, LLMInterface, ToolDefinition, PermissionMode } from './types';
import { ToolRegistry } from '../tools';
import { PermissionGate } from '../permissions/gate';
import { SessionManager } from './session-manager';
import { MemoryManager } from './memory';
import { CostTracker } from './cost-tracker';
import { AuditLogger } from './audit';
export interface AgentConfig {
    provider: LLMInterface;
    toolRegistry: ToolRegistry;
    permissionGate: PermissionGate;
    cwd: string;
    maxIterations?: number;
    enableCompaction?: boolean;
    enableSessionPersistence?: boolean;
    auditLogger?: AuditLogger;
}
export declare class AgentOrchestrator {
    private config;
    private messages;
    private claudeMdEntries;
    private sessionContext;
    private contextAssembler;
    private skillLoader;
    private compactor;
    private sessionManager;
    private memoryManager;
    private costTracker;
    private auditLogger?;
    private iterationCount;
    private maxIterations;
    constructor(config: AgentConfig);
    initialize(): Promise<void>;
    chat(userInput: string): Promise<string>;
    private buildSystemPrompt;
    private buildUserMessage;
    private detectSkillInvocation;
    getToolDefinitions(): ToolDefinition[];
    setPermissionMode(mode: PermissionMode): void;
    getPermissionMode(): PermissionMode;
    getMessages(): Message[];
    getWorkingDirectory(): string;
    getSessionManager(): SessionManager;
    getMemoryManager(): MemoryManager;
    getCostTracker(): CostTracker;
    getCostSummary(): string;
    getAuditLogger(): AuditLogger | undefined;
    flushAudit(): Promise<void>;
}
//# sourceMappingURL=orchestrator.d.ts.map