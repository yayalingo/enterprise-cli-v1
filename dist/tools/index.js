"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskTool = exports.AgentTool = exports.WebSearchTool = exports.WebFetchTool = exports.BashTool = exports.WriteTool = exports.EditTool = exports.GrepTool = exports.GlobTool = exports.ReadTool = exports.ToolRegistry = void 0;
const file_1 = require("./file");
Object.defineProperty(exports, "ReadTool", { enumerable: true, get: function () { return file_1.ReadTool; } });
Object.defineProperty(exports, "GlobTool", { enumerable: true, get: function () { return file_1.GlobTool; } });
Object.defineProperty(exports, "GrepTool", { enumerable: true, get: function () { return file_1.GrepTool; } });
const edit_1 = require("./edit");
Object.defineProperty(exports, "EditTool", { enumerable: true, get: function () { return edit_1.EditTool; } });
Object.defineProperty(exports, "WriteTool", { enumerable: true, get: function () { return edit_1.WriteTool; } });
const bash_1 = require("./bash");
Object.defineProperty(exports, "BashTool", { enumerable: true, get: function () { return bash_1.BashTool; } });
const web_1 = require("./web");
Object.defineProperty(exports, "WebFetchTool", { enumerable: true, get: function () { return web_1.WebFetchTool; } });
Object.defineProperty(exports, "WebSearchTool", { enumerable: true, get: function () { return web_1.WebSearchTool; } });
const subagent_1 = require("./subagent");
Object.defineProperty(exports, "AgentTool", { enumerable: true, get: function () { return subagent_1.AgentTool; } });
const task_1 = require("./task");
Object.defineProperty(exports, "TaskTool", { enumerable: true, get: function () { return task_1.TaskTool; } });
class ToolRegistry {
    tools = new Map();
    bashTool;
    agentTool;
    constructor(cwd) {
        this.bashTool = new bash_1.BashTool(cwd);
        this.agentTool = new subagent_1.AgentTool(cwd);
        this.register(new file_1.ReadTool(cwd));
        this.register(new file_1.GlobTool(cwd));
        this.register(new file_1.GrepTool(cwd));
        this.register(new edit_1.EditTool(cwd));
        this.register(new edit_1.WriteTool(cwd));
        this.register(this.bashTool);
        this.register(new web_1.WebFetchTool(cwd));
        this.register(new web_1.WebSearchTool(cwd));
        this.register(this.agentTool);
        this.register(new subagent_1.ExitWorktreeTool(cwd, this.agentTool));
        this.register(new task_1.TaskTool(cwd));
    }
    register(tool) {
        this.tools.set(tool.definition.name, tool);
    }
    get(name) {
        return this.tools.get(name);
    }
    getAll() {
        return Array.from(this.tools.values()).map(t => t.definition);
    }
    getOpenAIFormat() {
        return this.getAll().map(tool => ({
            type: 'function',
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.input_schema,
            },
        }));
    }
    getNames() {
        return Array.from(this.tools.keys());
    }
    getBashTool() {
        return this.bashTool;
    }
    getAgentTool() {
        return this.agentTool;
    }
}
exports.ToolRegistry = ToolRegistry;
//# sourceMappingURL=index.js.map