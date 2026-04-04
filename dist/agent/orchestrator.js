"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentOrchestrator = void 0;
const context_1 = require("./context");
const skills_1 = require("./skills");
const compactor_1 = require("./compactor");
const session_manager_1 = require("./session-manager");
const memory_1 = require("./memory");
const cost_tracker_1 = require("./cost-tracker");
class AgentOrchestrator {
    config;
    messages = [];
    claudeMdEntries = [];
    sessionContext;
    contextAssembler;
    skillLoader;
    compactor;
    sessionManager;
    memoryManager;
    costTracker;
    auditLogger;
    iterationCount = 0;
    maxIterations;
    constructor(config) {
        this.config = config;
        this.maxIterations = config.maxIterations || 100;
        this.contextAssembler = new context_1.ContextAssembler(config.cwd);
        this.skillLoader = new skills_1.SkillLoader();
        this.compactor = new compactor_1.ContextCompactor();
        this.sessionManager = new session_manager_1.SessionManager();
        this.memoryManager = new memory_1.MemoryManager(config.cwd);
        this.costTracker = new cost_tracker_1.CostTracker();
        this.auditLogger = config.auditLogger;
    }
    async initialize() {
        await Promise.all([
            (async () => {
                this.sessionContext = this.contextAssembler.getSessionContext();
            })(),
            (async () => {
                this.claudeMdEntries = await this.contextAssembler.loadClaudeMdFiles();
            })(),
            (async () => {
                await this.skillLoader.load();
                this.skillLoader.loadProjectSkills(this.config.cwd);
            })(),
            (async () => {
                await this.sessionManager.initialize();
            })(),
            (async () => {
                await this.memoryManager.initialize();
            })(),
        ]);
        const systemPrompt = this.buildSystemPrompt();
        this.messages.push({
            role: 'system',
            content: systemPrompt,
        });
    }
    async chat(userInput) {
        const userMessage = this.buildUserMessage(userInput);
        this.messages.push(userMessage);
        if (this.config.enableSessionPersistence) {
            this.sessionManager.addMessage(userMessage);
        }
        while (this.iterationCount < this.maxIterations) {
            this.iterationCount++;
            const response = await this.config.provider.chat(this.messages);
            if (response.usage) {
                this.costTracker.track(response.model || 'default', response.usage.input_tokens, response.usage.output_tokens);
            }
            const responseContent = response.content;
            if (typeof responseContent === 'string') {
                this.messages.push({
                    role: 'assistant',
                    content: responseContent,
                });
                if (response.stop_reason === 'end_turn') {
                    if (this.config.enableSessionPersistence) {
                        await this.sessionManager.save();
                    }
                    return responseContent;
                }
                continue;
            }
            const contentBlocks = responseContent;
            const assistantMessage = {
                role: 'assistant',
                content: contentBlocks,
            };
            const toolCalls = contentBlocks.filter((b) => b.type === 'tool_use');
            const textContent = contentBlocks.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
            if (textContent) {
                assistantMessage.content = [
                    { type: 'text', text: textContent },
                    ...toolCalls.map(tc => {
                        return {
                            type: 'tool_use',
                            id: tc.id || `tc_${Date.now()}`,
                            name: tc.name,
                            input: tc.input,
                        };
                    }),
                ];
            }
            else if (toolCalls.length > 0) {
                assistantMessage.content = toolCalls.map(tc => ({
                    type: 'tool_use',
                    id: tc.id || `tc_${Date.now()}`,
                    name: tc.name,
                    input: tc.input,
                }));
            }
            if (toolCalls.length === 0) {
                this.messages.push(assistantMessage);
                if (response.stop_reason === 'end_turn') {
                    if (this.config.enableSessionPersistence) {
                        await this.sessionManager.save();
                    }
                    return textContent || '';
                }
                continue;
            }
            this.messages.push(assistantMessage);
            for (const toolCall of toolCalls) {
                const permission = this.config.permissionGate.canUseTool(toolCall.name);
                if (!permission.allowed) {
                    const errorResult = {
                        tool_use_id: toolCall.id || '',
                        content: `Permission denied: ${permission.reason}`,
                        is_error: true,
                    };
                    this.messages.push({
                        role: 'tool',
                        tool_use_id: toolCall.id || '',
                        content: errorResult.content,
                    });
                    continue;
                }
                const tool = this.config.toolRegistry.get(toolCall.name);
                if (!tool) {
                    const errorResult = {
                        tool_use_id: toolCall.id || '',
                        content: `Tool ${toolCall.name} not found`,
                        is_error: true,
                    };
                    this.messages.push({
                        role: 'tool',
                        tool_use_id: toolCall.id || '',
                        content: errorResult.content,
                    });
                    continue;
                }
                try {
                    const startTime = Date.now();
                    const result = await tool.execute(toolCall.input);
                    const duration = Date.now() - startTime;
                    this.auditLogger?.log('TOOL_EXECUTE', toolCall.name, toolCall.input, result.content, !result.is_error, duration);
                    this.messages.push({
                        role: 'tool',
                        tool_use_id: toolCall.id || '',
                        content: result.content,
                    });
                }
                catch (error) {
                    this.auditLogger?.log('TOOL_ERROR', toolCall.name, toolCall.input, error.message, false, 0);
                    this.messages.push({
                        role: 'tool',
                        tool_use_id: toolCall.id || '',
                        content: `Error: ${error.message}`,
                    });
                }
            }
            if (this.config.enableCompaction && this.iterationCount % 10 === 0) {
                this.messages = await this.compactor.compact(this.messages, this.config.provider);
            }
            if (response.stop_reason === 'end_turn' && toolCalls.length === 0) {
                if (this.config.enableSessionPersistence) {
                    await this.sessionManager.save();
                }
                return textContent || '';
            }
        }
        return 'Max iterations reached';
    }
    buildSystemPrompt() {
        const skillsSection = this.skillLoader.getSkillSummary();
        return `You are an agent for Enterprise CLI, an AI coding assistant. Given the user's prompt, use the tools available to you to answer the user's question.

Be concise, direct, and to the point. Answer the user's question directly, without elaboration or unnecessary details.

When relevant, share file names and code snippets.

Available tools: Read, Edit, Write, Bash, Grep, Glob, WebFetch, WebSearch, Agent, Task${skillsSection}`;
    }
    buildUserMessage(userInput) {
        const parts = [];
        const contextMsg = this.contextAssembler.formatContextMessage(this.sessionContext);
        parts.push({ type: 'text', text: contextMsg });
        if (this.claudeMdEntries.length > 0) {
            const claudeMdMsg = this.contextAssembler.formatClaudeMdMessage(this.claudeMdEntries);
            parts.push({ type: 'text', text: claudeMdMsg });
        }
        const skillInvocation = this.detectSkillInvocation(userInput);
        if (skillInvocation) {
            const invokeMsg = `\n\n<skill_invoked>\nSkill: ${skillInvocation.name}\nBase Path: ${skillInvocation.basePath}\n\n${skillInvocation.content}\n</skill_invoked>`;
            parts.push({ type: 'text', text: invokeMsg });
        }
        parts.push({ type: 'text', text: `\n\nUser: ${userInput}` });
        return {
            role: 'user',
            content: parts,
        };
    }
    detectSkillInvocation(input) {
        const lower = input.toLowerCase();
        const skills = this.skillLoader.getSkillList();
        for (const skill of skills) {
            const patterns = [
                `use the ${skill.name} skill`,
                `use ${skill.name} skill`,
                `using the ${skill.name}`,
                `use ${skill.name}`,
                `${skill.name} skill`,
            ];
            for (const pattern of patterns) {
                if (lower.includes(pattern)) {
                    const invocation = this.skillLoader.invoke(skill.name);
                    if (invocation)
                        return invocation;
                }
            }
        }
        return null;
    }
    getToolDefinitions() {
        return this.config.toolRegistry.getAll();
    }
    setPermissionMode(mode) {
        this.config.permissionGate.setMode(mode);
    }
    getPermissionMode() {
        return this.config.permissionGate.getMode();
    }
    getMessages() {
        return this.messages;
    }
    getWorkingDirectory() {
        return this.config.cwd;
    }
    getSessionManager() {
        return this.sessionManager;
    }
    getMemoryManager() {
        return this.memoryManager;
    }
    getCostTracker() {
        return this.costTracker;
    }
    getCostSummary() {
        return this.costTracker.getFormattedSummary();
    }
    getAuditLogger() {
        return this.auditLogger;
    }
    async flushAudit() {
        await this.auditLogger?.flush();
    }
}
exports.AgentOrchestrator = AgentOrchestrator;
//# sourceMappingURL=orchestrator.js.map