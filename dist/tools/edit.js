"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WriteTool = exports.EditTool = void 0;
const fs_1 = require("fs");
class EditTool {
    cwd;
    constructor(cwd) {
        this.cwd = cwd;
    }
    get definition() {
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
    async execute(input) {
        const { filePath, oldString, newString } = input;
        if (!filePath || !oldString || newString === undefined) {
            return { tool_use_id: '', content: 'Error: filePath, oldString, and newString are required', is_error: true };
        }
        try {
            if (!(0, fs_1.existsSync)(filePath)) {
                return { tool_use_id: '', content: `Error: File not found: ${filePath}`, is_error: true };
            }
            const { readFile, writeFile } = await Promise.resolve().then(() => __importStar(require('fs/promises')));
            const content = await readFile(filePath, 'utf-8');
            if (!content.includes(oldString)) {
                return { tool_use_id: '', content: `Error: oldString not found in file`, is_error: true };
            }
            const newContent = content.replace(oldString, newString);
            await writeFile(filePath, newContent, 'utf-8');
            return { tool_use_id: '', content: `Edited ${filePath}` };
        }
        catch (error) {
            return { tool_use_id: '', content: `Error editing file: ${error}`, is_error: true };
        }
    }
}
exports.EditTool = EditTool;
class WriteTool {
    cwd;
    constructor(cwd) {
        this.cwd = cwd;
    }
    get definition() {
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
    async execute(input) {
        const { filePath, content } = input;
        if (!filePath || content === undefined) {
            return { tool_use_id: '', content: 'Error: filePath and content are required', is_error: true };
        }
        try {
            const { writeFile, mkdir } = await Promise.resolve().then(() => __importStar(require('fs/promises')));
            const { dirname } = await Promise.resolve().then(() => __importStar(require('path')));
            const dir = dirname(filePath);
            await mkdir(dir, { recursive: true });
            await writeFile(filePath, content, 'utf-8');
            return { tool_use_id: '', content: `Wrote ${filePath}` };
        }
        catch (error) {
            return { tool_use_id: '', content: `Error writing file: ${error}`, is_error: true };
        }
    }
}
exports.WriteTool = WriteTool;
//# sourceMappingURL=edit.js.map