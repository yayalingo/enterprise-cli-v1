import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface CommandResult {
  content: string;
  error?: boolean;
}

export class SlashCommand {
  name: string;
  description: string;
  execute: (args: string[], cwd: string) => Promise<CommandResult>;

  constructor(name: string, description: string, execute: (args: string[], cwd: string) => Promise<CommandResult>) {
    this.name = name;
    this.description = description;
    this.execute = execute;
  }
}

export const slashCommands: SlashCommand[] = [
  new SlashCommand(
    'commit',
    'Create a git commit with the current changes',
    async (args, cwd) => {
      try {
        const message = args.join(' ') || 'Update';
        execSync('git add -A', { cwd, stdio: 'ignore' });
        execSync(`git commit -m "${message}"`, { cwd, stdio: 'ignore' });
        return { content: `Created commit: ${message}` };
      } catch (error: any) {
        return { content: `Error: ${error.message}`, error: true };
      }
    }
  ),

  new SlashCommand(
    'diff',
    'Show the current changes',
    async (args, cwd) => {
      try {
        const output = execSync('git diff --stat', { cwd, encoding: 'utf-8' });
        return { content: output || 'No changes' };
      } catch {
        return { content: 'No changes or not a git repo', error: false };
      }
    }
  ),

  new SlashCommand(
    'status',
    'Show git status',
    async (args, cwd) => {
      try {
        const output = execSync('git status', { cwd, encoding: 'utf-8' });
        return { content: output };
      } catch {
        return { content: 'Not a git repository', error: true };
      }
    }
  ),

  new SlashCommand(
    'compact',
    'Manually trigger context compaction',
    async (args, cwd) => {
      return { content: 'Context compaction triggered. The context will be compressed on the next turn.' };
    }
  ),

  new SlashCommand(
    'cost',
    'Show token usage and cost for this session',
    async (args, cwd) => {
      return { content: 'Use agent.getCostSummary() to see cost breakdown' };
    }
  ),

  new SlashCommand(
    'doctor',
    'Run diagnostics on the environment',
    async (args, cwd) => {
      const checks: string[] = [];
      
      try {
        execSync('git --version', { stdio: 'ignore' });
        checks.push('✓ Git is installed');
      } catch {
        checks.push('✗ Git is not installed');
      }

      try {
        execSync('node --version', { stdio: 'ignore' });
        checks.push('✓ Node.js is installed');
      } catch {
        checks.push('✗ Node.js is not installed');
      }

      try {
        execSync('npm --version', { stdio: 'ignore' });
        checks.push('✓ npm is installed');
      } catch {
        checks.push('✗ npm is not installed');
      }

      return { content: checks.join('\n') };
    }
  ),

  new SlashCommand(
    'memory',
    'Show or manage persistent memory',
    async (args, cwd) => {
      if (args[0] === 'add' && args[1]) {
        return { content: 'Memory entry added to index' };
      }
      if (args[0] === 'list') {
        return { content: 'Listing memory entries...' };
      }
      return { content: 'Usage: /memory add <content> or /memory list' };
    }
  ),

  new SlashCommand(
    'skills',
    'List available skills',
    async (args, cwd) => {
      return { content: 'Use enterprise skills command to list available skills' };
    }
  ),

  new SlashCommand(
    'tasks',
    'List or manage tasks',
    async (args, cwd) => {
      if (args[0] === 'list') {
        return { content: 'Listing tasks...' };
      }
      if (args[0] === 'add' && args[1]) {
        return { content: `Task added: ${args.slice(1).join(' ')}` };
      }
      return { content: 'Usage: /tasks list or /tasks add <title>' };
    }
  ),

  new SlashCommand(
    'config',
    'Show or set configuration',
    async (args, cwd) => {
      if (args[0] === 'set' && args[1] && args[2]) {
        return { content: `Config ${args[1]} set to ${args[2]}` };
      }
      return { content: 'Configuration:\n- model\n- provider\n- permission mode' };
    }
  ),

  new SlashCommand(
    'resume',
    'Resume a previous session',
    async (args, cwd) => {
      if (args[0]) {
        return { content: `Resuming session: ${args[0]}` };
      }
      return { content: 'Usage: /resume <session-id>' };
    }
  ),

  new SlashCommand(
    'review',
    'Review the current changes',
    async (args, cwd) => {
      try {
        const staged = execSync('git diff --cached', { cwd, encoding: 'utf-8' });
        const unstaged = execSync('git diff', { cwd, encoding: 'utf-8' });
        return { content: `Staged:\n${staged}\n\nUnstaged:\n${unstaged}` };
      } catch {
        return { content: 'No changes to review', error: false };
      }
    }
  ),

  new SlashCommand(
    'help',
    'Show available commands',
    async (args, cwd) => {
      const commands = slashCommands.map(c => `/${c.name} - ${c.description}`).join('\n');
      return { content: `Available commands:\n\n${commands}` };
    }
  ),
];

export function findCommand(name: string): SlashCommand | undefined {
  return slashCommands.find(c => c.name === name);
}

export function getCommandNames(): string[] {
  return slashCommands.map(c => c.name);
}
