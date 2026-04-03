import { execa } from 'execa';
import { existsSync } from 'fs';
import type { ToolDefinition, ToolResult } from '../agent/types';

export class BashTool {
  private cwd: string;
  private workingDir: string;

  constructor(cwd: string) {
    this.cwd = cwd;
    this.workingDir = cwd;
  }

  get definition(): ToolDefinition {
    return {
      name: 'Bash',
      description: 'Executes shell commands. Working directory persists across commands, but environment variables do not persist.',
      input_schema: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Shell command to execute' },
          description: { type: 'string', description: 'Description of what the command does' },
          timeout: { type: 'number', description: 'Timeout in milliseconds' },
        },
        required: ['command'],
      },
    };
  }

  getWorkingDirectory(): string {
    return this.workingDir;
  }

  async execute(input: { command?: string; description?: string; timeout?: number }): Promise<ToolResult> {
    const command = input.command;
    if (!command) {
      return { tool_use_id: '', content: 'Error: command is required', is_error: true };
    }

    try {
      const result = await execa(command, {
        shell: true,
        cwd: this.workingDir,
        timeout: input.timeout || 60000,
        reject: false,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.workingDir = result.cwd || this.workingDir;

      let output = '';
      if (result.stdout) {
        output += result.stdout;
      }
      if (result.stderr) {
        output += (output ? '\n' : '') + 'STDERR: ' + result.stderr;
      }

      if (result.failed) {
        return { tool_use_id: '', content: output || `Command failed with exit code ${result.exitCode}`, is_error: true };
      }

      return { tool_use_id: '', content: output || `(Command completed with exit code ${result.exitCode})` };
    } catch (error: any) {
      return { tool_use_id: '', content: `Error executing command: ${error.message}`, is_error: true };
    }
  }
}
