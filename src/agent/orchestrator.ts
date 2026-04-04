import type { Message, LLMInterface, ToolDefinition, ToolCall, ToolResult, PermissionMode, ClaudeMdEntry, SessionContext } from './types';
import { ToolRegistry } from '../tools';
import { PermissionGate } from '../permissions/gate';
import { ContextAssembler } from './context';
import { SkillLoader } from './skills';

export interface AgentConfig {
  provider: LLMInterface;
  toolRegistry: ToolRegistry;
  permissionGate: PermissionGate;
  cwd: string;
  maxIterations?: number;
}

export class AgentOrchestrator {
  private config: AgentConfig;
  private messages: Message[] = [];
  private claudeMdEntries: ClaudeMdEntry[] = [];
  private sessionContext!: SessionContext;
  private contextAssembler: ContextAssembler;
  private skillLoader: SkillLoader;
  private iterationCount = 0;
  private maxIterations: number;

  constructor(config: AgentConfig) {
    this.config = config;
    this.maxIterations = config.maxIterations || 100;
    this.contextAssembler = new ContextAssembler(config.cwd);
    this.skillLoader = new SkillLoader();
  }

  async initialize(): Promise<void> {
    this.sessionContext = this.contextAssembler.getSessionContext();
    this.claudeMdEntries = await this.contextAssembler.loadClaudeMdFiles();

    await this.skillLoader.load();
    this.skillLoader.loadProjectSkills(this.config.cwd);

    const systemPrompt = this.buildSystemPrompt();
    this.messages.push({
      role: 'system',
      content: systemPrompt,
    });
  }

  async chat(userInput: string): Promise<string> {
    const userMessage = this.buildUserMessage(userInput);
    this.messages.push(userMessage);

    while (this.iterationCount < this.maxIterations) {
      this.iterationCount++;

      const response = await this.config.provider.chat(this.messages);

      const responseContent = response.content;

      if (typeof responseContent === 'string') {
        this.messages.push({
          role: 'assistant',
          content: responseContent,
        });

        if (response.stop_reason === 'end_turn') {
          return responseContent;
        }
        continue;
      }

      const contentBlocks = responseContent;
      const assistantMessage: Message = {
        role: 'assistant',
        content: contentBlocks,
      };

      const toolCalls = contentBlocks.filter((b: any) => b.type === 'tool_use') as ToolCall[];
      const textContent = contentBlocks.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');

      if (textContent) {
        assistantMessage.content = [
          { type: 'text', text: textContent },
          ...toolCalls.map(tc => {
            return {
              type: 'tool_use' as const,
              id: tc.id || `tc_${Date.now()}`,
              name: tc.name,
              input: tc.input,
            };
          }),
        ];
      } else if (toolCalls.length > 0) {
        assistantMessage.content = toolCalls.map(tc => ({
          type: 'tool_use' as const,
          id: tc.id || `tc_${Date.now()}`,
          name: tc.name,
          input: tc.input,
        }));
      }

      if (toolCalls.length === 0) {
        this.messages.push(assistantMessage);
        if (response.stop_reason === 'end_turn') {
          return textContent || '';
        }
        continue;
      }

      this.messages.push(assistantMessage);

      for (const toolCall of toolCalls) {
        const permission = this.config.permissionGate.canUseTool(toolCall.name);

        if (!permission.allowed) {
          const errorResult: ToolResult = {
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
          const errorResult: ToolResult = {
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
          const result = await tool.execute(toolCall.input);
          this.messages.push({
            role: 'tool',
            tool_use_id: toolCall.id || '',
            content: result.content,
          });
        } catch (error: any) {
          this.messages.push({
            role: 'tool',
            tool_use_id: toolCall.id || '',
            content: `Error: ${error.message}`,
          });
        }
      }

      if (response.stop_reason === 'end_turn' && toolCalls.length === 0) {
        return textContent || '';
      }
    }

    return 'Max iterations reached';
  }

  private buildSystemPrompt(): string {
    const skillsSection = this.skillLoader.getSkillSummary();
    
    return `You are an agent for Enterprise CLI, an AI coding assistant. Given the user's prompt, use the tools available to you to answer the user's question.

Be concise, direct, and to the point. Answer the user's question directly, without elaboration or unnecessary details.

When relevant, share file names and code snippets.

Available tools: Read, Edit, Write, Bash, Grep, Glob${skillsSection}`;
  }

  private buildUserMessage(userInput: string): Message {
    const parts: any[] = [];

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

  private detectSkillInvocation(input: string): { name: string; basePath: string; content: string } | null {
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
          if (invocation) return invocation;
        }
      }
    }
    return null;
  }

  getToolDefinitions(): ToolDefinition[] {
    return this.config.toolRegistry.getAll();
  }

  setPermissionMode(mode: PermissionMode): void {
    this.config.permissionGate.setMode(mode);
  }

  getPermissionMode(): PermissionMode {
    return this.config.permissionGate.getMode();
  }

  getMessages(): Message[] {
    return this.messages;
  }

  getWorkingDirectory(): string {
    return this.config.cwd;
  }
}
