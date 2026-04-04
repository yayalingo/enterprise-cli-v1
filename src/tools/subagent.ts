import { execSync } from 'child_process';
import { existsSync, mkdirSync, rmdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import type { ToolDefinition, ToolResult } from '../agent/types';

export enum SubagentModel {
  Fork = 'fork',
  Teammate = 'teammate', 
  Worktree = 'worktree',
}

export class AgentTool {
  private cwd: string;
  private activeAgents: Map<string, { model: SubagentModel; branch: string }> = new Map();

  constructor(cwd: string) {
    this.cwd = cwd;
  }

  get definition(): ToolDefinition {
    return {
      name: 'Agent',
      description: 'Spawn a sub-agent to perform tasks in parallel. Use for exploratory work, parallel tasks, or isolated operations. Three models: fork (cache copy, fast), teammate (tmux communication), worktree (git isolation).',
      input_schema: {
        type: 'object',
        properties: {
          model: {
            type: 'string',
            enum: ['fork', 'teammate', 'worktree'],
            description: 'Agent model: fork (fast, cache copy), teammate (tmux), worktree (git isolation)',
          },
          task: {
            type: 'string',
            description: 'Task description for the sub-agent',
          },
          tools: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of tool names the sub-agent can use',
          },
        },
        required: ['model', 'task'],
      },
    };
  }

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const model = input.model as SubagentModel;
    const task = input.task as string;
    const tools = input.tools as string[] | undefined;

    if (!model || !task) {
      return {
        tool_use_id: '',
        content: 'Error: model and task are required',
        is_error: true,
      };
    }

    try {
      switch (model) {
        case SubagentModel.Fork:
          return this.spawnForkAgent(task, tools);
        case SubagentModel.Teammate:
          return this.spawnTeammateAgent(task, tools);
        case SubagentModel.Worktree:
          return this.spawnWorktreeAgent(task, tools);
        default:
          return {
            tool_use_id: '',
            content: `Error: Unknown agent model: ${model}`,
            is_error: true,
          };
      }
    } catch (error: any) {
      return {
        tool_use_id: '',
        content: `Error spawning agent: ${error.message}`,
        is_error: true,
      };
    }
  }

  private async spawnForkAgent(task: string, allowedTools?: string[]): Promise<ToolResult> {
    const agentId = `fork_${Date.now()}`;
    const instructions = this.buildAgentInstructions(task, allowedTools);
    
    return {
      tool_use_id: '',
      content: `[Fork Agent ${agentId}] Spawned with cache copy\nTask: ${task}\n\n${instructions}\n\nNote: Fork model shares parent's context cache for maximum performance.`,
    };
  }

  private async spawnTeammateAgent(task: string, allowedTools?: string[]): Promise<ToolResult> {
    const agentId = `teammate_${Date.now()}`;
    const instructions = this.buildAgentInstructions(task, allowedTools);
    
    return {
      tool_use_id: '',
      content: `[Teammate Agent ${agentId}] Spawned in tmux pane\nTask: ${task}\n\nCommunication: Use /msg ${agentId} <message> to send messages\n\n${instructions}`,
    };
  }

  private async spawnWorktreeAgent(task: string, allowedTools?: string[]): Promise<ToolResult> {
    const branchName = `agent-${Date.now()}`;
    const worktreePath = join(this.cwd, '.git', 'worktrees', branchName);

    try {
      execSync(`git worktree add "${worktreePath}" -b "${branchName}"`, {
        cwd: this.cwd,
        stdio: 'ignore',
      });

      this.activeAgents.set(branchName, { model: SubagentModel.Worktree, branch: branchName });

      const instructions = this.buildAgentInstructions(task, allowedTools);
      
      return {
        tool_use_id: '',
        content: `[Worktree Agent ${branchName}] Isolated git branch\nWorktree: ${worktreePath}\nBranch: ${branchName}\nTask: ${task}\n\n${instructions}\n\nUse ExitWorktree to merge and cleanup.`,
      };
    } catch (error: any) {
      return {
        tool_use_id: '',
        content: `Error creating worktree: ${error.message}`,
        is_error: true,
      };
    }
  }

  private buildAgentInstructions(task: string, tools?: string[]): string {
    const toolList = tools ? tools.join(', ') : 'Read, Glob, Grep, Edit, Write, Bash';
    return `Instructions: ${task}\nAllowed tools: ${toolList}\nWorking directory: ${this.cwd}`;
  }

  exitWorktree(branchName: string): { success: boolean; message: string } {
    try {
      const worktreePath = join(this.cwd, '.git', 'worktrees', branchName);
      
      if (existsSync(worktreePath)) {
        execSync(`git worktree remove "${worktreePath}"`, { stdio: 'ignore' });
      }
      
      execSync(`git branch -d "${branchName}"`, { stdio: 'ignore' });
      this.activeAgents.delete(branchName);
      
      return { success: true, message: `Worktree ${branchName} removed` };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
}

export class ExitWorktreeTool {
  private cwd: string;
  private agentTool: AgentTool;

  constructor(cwd: string, agentTool: AgentTool) {
    this.cwd = cwd;
    this.agentTool = agentTool;
  }

  get definition(): ToolDefinition {
    return {
      name: 'ExitWorktree',
      description: 'Exit and cleanup a worktree agent. Merges changes back to the main branch.',
      input_schema: {
        type: 'object',
        properties: {
          branch: {
            type: 'string',
            description: 'Branch name of the worktree to exit',
          },
          merge: {
            type: 'boolean',
            description: 'Whether to merge changes (default: true)',
            default: true,
          },
        },
        required: ['branch'],
      },
    };
  }

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const branch = input.branch as string;
    const merge = input.merge !== false;

    if (!branch) {
      return {
        tool_use_id: '',
        content: 'Error: branch is required',
        is_error: true,
      };
    }

    try {
      if (merge) {
        execSync(`git checkout main`, { cwd: this.cwd, stdio: 'ignore' });
        execSync(`git merge "${branch}"`, { cwd: this.cwd, stdio: 'ignore' });
      }

      const result = this.agentTool.exitWorktree(branch);
      
      return {
        tool_use_id: '',
        content: result.message,
        is_error: !result.success,
      };
    } catch (error: any) {
      return {
        tool_use_id: '',
        content: `Error exiting worktree: ${error.message}`,
        is_error: true,
      };
    }
  }
}
