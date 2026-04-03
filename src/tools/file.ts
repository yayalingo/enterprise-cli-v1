import { readFile as fsReadFile } from 'fs/promises';
import { existsSync } from 'fs';
import type { ToolDefinition, ToolResult } from '../agent/types';

export class ReadTool {
  private cwd: string;

  constructor(cwd: string) {
    this.cwd = cwd;
  }

  get definition(): ToolDefinition {
    return {
      name: 'Read',
      description: 'Reads the contents of files. The filePath parameter must be an absolute path.',
      input_schema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Absolute path to file' },
          limit: { type: 'number', description: 'Maximum lines to read' },
          offset: { type: 'number', description: 'Line number to start from (1-indexed)' },
        },
        required: ['filePath'],
      },
    };
  }

  async execute(input: { filePath?: string; limit?: number; offset?: number }): Promise<ToolResult> {
    const filePath = input.filePath;
    if (!filePath) {
      return { tool_use_id: '', content: 'Error: filePath is required', is_error: true };
    }

    try {
      if (!existsSync(filePath)) {
        return { tool_use_id: '', content: `Error: File not found: ${filePath}`, is_error: true };
      }

      let content = await fsReadFile(filePath, 'utf-8');
      const lines = content.split('\n');

      const offset = input.offset || 1;
      const limit = input.limit || 2000;

      const startLine = offset - 1;
      const endLine = Math.min(startLine + limit, lines.length);

      if (startLine >= lines.length) {
        return { tool_use_id: '', content: `Error: Offset ${offset} is beyond file length ${lines.length}`, is_error: true };
      }

      content = lines.slice(startLine, endLine).join('\n');

      const lineInfo = endLine - startLine < lines.length
        ? `\n[Showing ${startLine + 1}-${endLine} of ${lines.length} lines]`
        : `\n[Showing ${startLine + 1}-${endLine} lines]`;

      return { tool_use_id: '', content: content + lineInfo };
    } catch (error) {
      return { tool_use_id: '', content: `Error reading file: ${error}`, is_error: true };
    }
  }
}

export class GlobTool {
  private cwd: string;

  constructor(cwd: string) {
    this.cwd = cwd;
  }

  get definition(): ToolDefinition {
    return {
      name: 'Glob',
      description: 'Fast file pattern matching tool that works with any codebase size. Supports glob patterns.',
      input_schema: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Glob pattern (e.g., "*.ts" or "src/**/*.js")' },
          path: { type: 'string', description: 'Directory to search in' },
        },
        required: ['pattern'],
      },
    };
  }

  async execute(input: { pattern?: string; path?: string }): Promise<ToolResult> {
    const pattern = input.pattern;
    if (!pattern) {
      return { tool_use_id: '', content: 'Error: pattern is required', is_error: true };
    }

    try {
      const { glob } = await import('tinyglobby');
      const searchPath = input.path || this.cwd;

      const files = await glob(pattern, {
        cwd: searchPath,
        absolute: true,
        onlyFiles: true,
      });

      if (files.length === 0) {
        return { tool_use_id: '', content: 'No files found matching pattern' };
      }

      return { tool_use_id: '', content: files.join('\n') };
    } catch (error) {
      return { tool_use_id: '', content: `Error running glob: ${error}`, is_error: true };
    }
  }
}

export class GrepTool {
  private cwd: string;

  constructor(cwd: string) {
    this.cwd = cwd;
  }

  get definition(): ToolDefinition {
    return {
      name: 'Grep',
      description: 'Fast content search tool that works with any codebase size. Searches file contents using regular expressions.',
      input_schema: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Regex pattern to search for' },
          include: { type: 'string', description: 'File pattern to include (e.g., "*.ts")' },
          path: { type: 'string', description: 'Directory to search in' },
          outputMode: { type: 'string', enum: ['content', 'files_with_matches', 'count'], description: 'Output format' },
        },
        required: ['pattern'],
      },
    };
  }

  async execute(input: { pattern?: string; include?: string; path?: string; outputMode?: string }): Promise<ToolResult> {
    const pattern = input.pattern;
    if (!pattern) {
      return { tool_use_id: '', content: 'Error: pattern is required', is_error: true };
    }

    try {
      const { glob } = await import('tinyglobby');
      const { grep: grepImpl } = await import('grep-async');
      const searchPath = input.path || this.cwd;

      let files: string[] = [];
      if (input.include) {
        files = await glob(input.include, { cwd: searchPath, onlyFiles: true });
      }

      const results = await grepImpl(pattern, files.length > 0 ? files : [searchPath], {
        onlyFiles: files.length === 0,
        recursive: true,
        outputMode: input.outputMode as any || 'content',
      });

      if (!results || results.length === 0) {
        return { tool_use_id: '', content: 'No matches found' };
      }

      return { tool_use_id: '', content: results };
    } catch (error) {
      return { tool_use_id: '', content: `Error running grep: ${error}`, is_error: true };
    }
  }
}
