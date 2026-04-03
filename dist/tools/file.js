"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GrepTool = exports.GlobTool = exports.ReadTool = void 0;
const promises_1 = require("fs/promises");
const fs_1 = require("fs");
const path_1 = require("path");
class ReadTool {
    cwd;
    constructor(cwd) {
        this.cwd = cwd;
    }
    get definition() {
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
    async execute(input) {
        const filePath = input.filePath;
        if (!filePath) {
            return { tool_use_id: '', content: 'Error: filePath is required', is_error: true };
        }
        try {
            if (!(0, fs_1.existsSync)(filePath)) {
                return { tool_use_id: '', content: `Error: File not found: ${filePath}`, is_error: true };
            }
            let content = await (0, promises_1.readFile)(filePath, 'utf-8');
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
        }
        catch (error) {
            return { tool_use_id: '', content: `Error reading file: ${error.message}`, is_error: true };
        }
    }
}
exports.ReadTool = ReadTool;
class GlobTool {
    cwd;
    constructor(cwd) {
        this.cwd = cwd;
    }
    get definition() {
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
    globMatch(pattern, filepath) {
        const regexPattern = pattern
            .replace(/\./g, '\\.')
            .replace(/\*\*/g, '((?!/).)*')
            .replace(/\*/g, '[^/]*')
            .replace(/\?/g, '.');
        return new RegExp('^' + regexPattern + '$').test(filepath);
    }
    async findFiles(dir, pattern, results = []) {
        try {
            const entries = await (0, promises_1.readdir)(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = (0, path_1.join)(dir, entry.name);
                if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                    await this.findFiles(fullPath, pattern, results);
                }
                else if (entry.isFile()) {
                    const relativePath = fullPath.substring(dir.length + 1);
                    if (this.globMatch(pattern, relativePath) || this.globMatch(pattern, entry.name)) {
                        results.push(fullPath);
                    }
                }
            }
        }
        catch {
        }
        return results;
    }
    async execute(input) {
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
        }
        catch (error) {
            return { tool_use_id: '', content: `Error running glob: ${error.message}`, is_error: true };
        }
    }
}
exports.GlobTool = GlobTool;
class GrepTool {
    cwd;
    constructor(cwd) {
        this.cwd = cwd;
    }
    get definition() {
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
    async searchInFile(filePath, pattern, outputMode) {
        const results = [];
        try {
            const content = await (0, promises_1.readFile)(filePath, 'utf-8');
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                if (pattern.test(lines[i])) {
                    if (outputMode === 'count') {
                        results.push(`${filePath}:1`);
                        break;
                    }
                    else if (outputMode === 'files_with_matches') {
                        results.push(filePath);
                        break;
                    }
                    else {
                        results.push(`${filePath}:${i + 1}:${lines[i]}`);
                    }
                }
            }
        }
        catch {
        }
        return results;
    }
    async findFiles(dir, include, results = []) {
        try {
            const entries = await (0, promises_1.readdir)(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = (0, path_1.join)(dir, entry.name);
                if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                    await this.findFiles(fullPath, include, results);
                }
                else if (entry.isFile()) {
                    if (!include || new RegExp(include.replace(/\*/g, '.*').replace(/\?/g, '.')).test(entry.name)) {
                        results.push(fullPath);
                    }
                }
            }
        }
        catch {
        }
        return results;
    }
    async execute(input) {
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
            const allResults = [];
            const uniqueFiles = new Set();
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
        }
        catch (error) {
            return { tool_use_id: '', content: `Error running grep: ${error.message}`, is_error: true };
        }
    }
}
exports.GrepTool = GrepTool;
//# sourceMappingURL=file.js.map