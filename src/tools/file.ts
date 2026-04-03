import { readFile, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
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

      let content = await readFile(filePath, 'utf-8');
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
    } catch (error: any) {
      return { tool_use_id: '', content: `Error reading file: ${error.message}`, is_error: true };
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

  private globMatch(pattern: string, filepath: string): boolean {
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '((?!/).)*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.');
    return new RegExp('^' + regexPattern + '$').test(filepath);
  }

  private async findFiles(dir: string, pattern: string, results: string[] = []): Promise<string[]> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          await this.findFiles(fullPath, pattern, results);
        } else if (entry.isFile()) {
          const relativePath = fullPath.substring(dir.length + 1);
          if (this.globMatch(pattern, relativePath) || this.globMatch(pattern, entry.name)) {
            results.push(fullPath);
          }
        }
      }
    } catch {
    }
    return results;
  }

  async execute(input: { pattern?: string; path?: string }): Promise<ToolResult> {
    const pattern = input.pattern;
    if (!pattern) {
      return { tool_use_id: '', content: 'Error: pattern is required', is_error: true };
    }

    try {
      const searchPath = input.path || this.cwd;
      const files = await this.findFiles(searchPath, pattern);

      if (files.length === 0) {
        return { tool_use_id: '', content: 'No files found matching pattern' };
      }

      return { tool_use_id: '', content: files.join('\n') };
    } catch (error: any) {
      return { tool_use_id: '', content: `Error running glob: ${error.message}`, is_error: true };
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

  private async searchInFile(filePath: string, pattern: RegExp, outputMode: string): Promise<string[]> {
    const results: string[] = [];
    try {
      const content = await readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        if (pattern.test(lines[i])) {
          if (outputMode === 'count') {
            results.push(`${filePath}:1`);
            break;
          } else if (outputMode === 'files_with_matches') {
            results.push(filePath);
            break;
          } else {
            results.push(`${filePath}:${i + 1}:${lines[i]}`);
          }
        }
      }
    } catch {
    }
    return results;
  }

  private async findFiles(dir: string, include: string | undefined, results: string[] = []): Promise<string[]> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          await this.findFiles(fullPath, include, results);
        } else if (entry.isFile()) {
          if (!include || new RegExp(include.replace(/\*/g, '.*').replace(/\?/g, '.')).test(entry.name)) {
            results.push(fullPath);
          }
        }
      }
    } catch {
    }
    return results;
  }

  async execute(input: { pattern?: string; include?: string; path?: string; outputMode?: string }): Promise<ToolResult> {
    const pattern = input.pattern;
    if (!pattern) {
      return { tool_use_id: '', content: 'Error: pattern is required', is_error: true };
    }

    try {
      const searchPath = input.path || this.cwd;
      const regex = new RegExp(pattern, 'i');
      const outputMode = input.outputMode || 'content';
      
      const files = input.include 
        ? await this.findFiles(searchPath, input.include)
        : await this.findFiles(searchPath, undefined);

      const allResults: string[] = [];
      const uniqueFiles = new Set<string>();

      for (const file of files) {
        const results = await this.searchInFile(file, regex, outputMode);
        if (results.length > 0) {
          uniqueFiles.add(file);
          allResults.push(...results);
        }
      }

      if (allResults.length === 0) {
        return { tool_use_id: '', content: 'No matches found' };
      }

      return { tool_use_id: '', content: allResults.join('\n') };
    } catch (error: any) {
      return { tool_use_id: '', content: `Error running grep: ${error.message}`, is_error: true };
    }
  }
}
