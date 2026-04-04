export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';
export interface Message {
    role: MessageRole;
    content: string | ContentBlock[];
    tool_calls?: ToolCall[];
    tool_use_id?: string;
}
export type ContentBlock = {
    type: 'text';
    text: string;
} | {
    type: 'tool_use';
    id: string;
    name: string;
    input: Record<string, unknown>;
} | {
    type: 'tool_result';
    tool_use_id: string;
    content: string;
    is_error?: boolean;
};
export interface ToolDefinition {
    name: string;
    description: string;
    input_schema: ToolInputSchema;
}
export interface ToolInputSchema {
    type: 'object';
    properties: Record<string, SchemaProperty>;
    required?: string[];
}
export interface SchemaProperty {
    type: 'string' | 'number' | 'boolean';
    description?: string;
    enum?: string[];
}
export interface ToolCall {
    id: string;
    name: string;
    input: Record<string, unknown>;
}
export interface ToolResult {
    tool_use_id: string;
    content: string;
    is_error?: boolean;
}
export type ProviderType = 'anthropic' | 'openai' | 'ollama' | 'custom';
export interface LLMConfig {
    provider: ProviderType;
    apiKey?: string;
    baseUrl?: string;
    model: string;
    maxTokens?: number;
    temperature?: number;
}
export interface LLMResponse {
    content: string | ContentBlock[];
    stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence';
    usage: {
        input_tokens: number;
        output_tokens: number;
    };
}
export interface LLMInterface {
    chat(messages: Message[]): Promise<LLMResponse>;
}
export type PermissionMode = 'default' | 'acceptEdits' | 'plan' | 'auto' | 'bypassPermissions';
export interface PermissionRule {
    allow?: string[];
    deny?: string[];
    ask?: string[];
}
export interface PermissionConfig {
    mode: PermissionMode;
    rules?: PermissionRule;
}
export interface ContextConfig {
    maxTokens: number;
    compactionThreshold: number;
    outputHeadroom: number;
}
export interface ClaudeMdEntry {
    path: string;
    content: string;
    scope: 'global' | 'project' | 'local' | 'parent';
}
export interface SessionContext {
    workingDirectory: string;
    isGitRepo: boolean;
    platform: string;
    date: string;
    gitStatus?: GitStatus;
}
export interface GitStatus {
    branch: string;
    mainBranch: string;
    modified: string[];
    deleted: string[];
    untracked: string[];
    recentCommits: string[];
}
export interface CompactionSummary {
    userIntent: string;
    keyDecisions: string[];
    filesTouched: {
        path: string;
        why: string;
    }[];
    errorsEncountered: {
        error: string;
        fix: string;
    }[];
    pendingTasks: string[];
    currentState: string;
    nextStep: string;
}
export interface CompactionConfig {
    triggerPercent: number;
    outputHeadroom: number;
    compactionHeadroom: number;
    hotTailSize: number;
    sizeThreshold: number;
}
export interface Skill {
    name: string;
    description: string;
    allowedTools?: string[];
    basePath: string;
    content: string;
}
export interface SkillInvocation {
    name: string;
    basePath: string;
    content: string;
}
export type HookEvent = 'PreToolUse' | 'PostToolUse' | 'Notification' | 'SessionStart' | 'SessionStop' | 'SubagentStop' | 'Compact' | 'PermissionRequest';
export interface Hook {
    event: HookEvent;
    matcher?: {
        tool?: string;
        command?: string;
    };
    command: string;
    shell?: 'bash' | 'powershell';
}
export interface HookResult {
    allowed: boolean;
    output?: string;
    modifiedInput?: Record<string, unknown>;
    additionalContext?: string;
}
export interface Session {
    id: string;
    messages: Message[];
    permissionMode: PermissionMode;
    workingDirectory: string;
    createdAt: Date;
    lastActivityAt: Date;
}
export interface CLIConfig {
    provider: ProviderType;
    apiKey?: string;
    model: string;
    permissionMode: PermissionMode;
    workingDirectory?: string;
}
export interface GlobalConfig {
    providers: Record<string, LLMConfig>;
    defaultProvider: string;
    defaultModel: string;
    defaultPermissionMode: PermissionMode;
    hooks?: Hook[];
    skills?: string[];
}
//# sourceMappingURL=types.d.ts.map