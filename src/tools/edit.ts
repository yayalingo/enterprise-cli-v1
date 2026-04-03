import { execa, type ExecaReturnValue } from 'execa';
import { existsSync } from 'fs';
import type { ToolDefinition, ToolResult } from '../agent/types';

export class EditTool {
  private cwd: string;

  constructor(cwd: string) {
    this.cwd = cwd;
  }

  get definition(): ToolDefinition {
    return {
      name: 'Edit',
      description: 'Makes targeted edits to specific files. For moving or renaming files, use Bash with mv command.',
      input_schema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Absolute path to file' },
          oldString: { type: 'string', description: 'Text to replace' },
          newString: { type: 'string', description: 'Replacement text' },
        },
        required: ['filePath', 'oldString', 'newString'],
      },
    };
  }

  async execute(input: { filePath?: string; oldString?: string; newString?: string }): Promise<ToolResult> {
    const { filePath, oldString, newString } = input;
    if (!filePath || !oldString || newString === undefined) {
      return { tool_use_id: '', content: 'Error: filePath, oldString, and newString are required', is_error: true };
    }

    try {
      if (!existsSync(filePath)) {
        return { tool_use_id: '', content: `Error: File not found: ${filePath}`, is_error: true };
      }

      const { readFile, writeFile } = await import('fs/promises');
      const content = await readFile(filePath, 'utf-8');

      if (!content.includes(oldString)) {
        return { tool_use_id: '', content: `Error: oldString not found in file`, is_error: true };
      }

      const newContent = content.replace(oldString, newString);
      await writeFile(filePath, newContent, 'utf-8');

      return { tool_use_id: '', content: `Edited ${filePath}` };
    } catch (error) {
      return { tool_use_id: '', content: `Error editing file: ${error}`, is_error: true };
    }
  }
}

export class WriteTool {
  private cwd: string;

  constructor(cwd: string) {
    this.cwd = cwd;
  }

  get definition(): ToolDefinition {
    return {
      name: 'Write',
      description: 'Creates or overwrites files at the specified path.',
      input_schema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Absolute path to file' },
          content: { type: 'string', description: 'Content to write' },
        },
        required: ['filePath', 'content'],
      },
    };
  }

  async execute(input: { filePath?: string; content?: string }): Promise<ToolResult> {
    const { filePath, content } = input;
    if (!filePath || content === undefined) {
      return { tool_use_id: '', content: 'Error: filePath and content are required', is_error: true };
    }

    try {
      const { writeFile, mkdir } = await import('fs/promises');
      const { dirname } = await import('path');

      const dir = dirname(filePath);
      await mkdir(dir, { recursive: true });

      await writeFile(filePath, content, 'utf-8');

      return { tool_use_id: '', content: `Wrote ${filePath}` };
    } catch (error) {
      return { tool_use_id: '', content: `Error writing file: ${error}`, is_error: true };
    }
  }
}
