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
const commander_1 = require("commander");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const orchestrator_1 = require("./agent/orchestrator");
const tools_1 = require("./tools");
const gate_1 = require("./permissions/gate");
const llm_1 = require("./providers/llm");
const program = new commander_1.Command();
program
    .name('enterprise')
    .description('Enterprise CLI - AI coding assistant')
    .version('1.0.0');
program
    .option('-m, --model <model>', 'Model to use')
    .option('-p, --provider <provider>', 'Provider (anthropic|openai|ollama|custom)')
    .option('--base-url <url>', 'Custom API base URL')
    .option('--api-key <key>', 'API key')
    .option('--mode <mode>', 'Permission mode (default|acceptEdits|plan|auto)')
    .option('-c, --cwd <directory>', 'Working directory', process.cwd());
program
    .command('skills')
    .description('List available skills')
    .action(async () => {
    await listSkills();
});
program
    .command('chat')
    .description('Start an interactive chat session')
    .option('-s, --session <id>', 'Resume session by ID')
    .action(async (options) => {
    await startChat({ ...program.opts(), ...options });
});
program
    .command('run <prompt>')
    .description('Run a single prompt')
    .action(async (prompt, options) => {
    await runOnce(prompt, { ...program.opts(), ...options });
});
program
    .command('sessions')
    .description('List saved sessions')
    .action(async () => {
    await listSessions();
});
program
    .command('governance')
    .description('Show governance status and audit logs')
    .option('--approve-tool <name>', 'Approve a tool for use')
    .action(async (options) => {
    await showGovernance(options);
});
program
    .command('mcp')
    .description('Manage MCP servers')
    .option('--add <name> <url>', 'Add MCP server')
    .action(async (options) => {
    await manageMCP(options);
});
program.parse();
const log = {
    blue: (s) => console.log('\x1b[36m' + s + '\x1b[0m'),
    gray: (s) => console.log('\x1b[90m' + s + '\x1b[0m'),
    green: (s) => console.log('\x1b[32m' + s + '\x1b[0m'),
    red: (s) => console.log('\x1b[31m' + s + '\x1b[0m'),
    white: (s) => console.log(s),
    yellow: (s) => console.log('\x1b[33m' + s + '\x1b[0m'),
};
function join(...paths) {
    return paths.join('/').replace(/\/+/g, '/');
}
async function loadConfig() {
    const configPaths = [
        join(process.env.HOME || '', '.enterprise-cli', 'config.json'),
        join(process.cwd(), '.enterprise-cli.json'),
    ];
    for (const path of configPaths) {
        if ((0, fs_1.existsSync)(path)) {
            try {
                const content = await (0, promises_1.readFile)(path, 'utf-8');
                return JSON.parse(content);
            }
            catch {
            }
        }
    }
    return null;
}
async function getProviderConfig(cmdOptions) {
    const config = await loadConfig();
    const provider = cmdOptions.provider || config?.defaultProvider || 'anthropic';
    let apiKey;
    let baseUrl;
    let model = cmdOptions.model || config?.defaultModel;
    if (provider === 'anthropic') {
        apiKey = cmdOptions.apiKey || process.env.ANTHROPIC_API_KEY;
        model = model || 'claude-sonnet-4-20250514';
    }
    else if (provider === 'openai') {
        apiKey = cmdOptions.apiKey || process.env.OPENAI_API_KEY;
        baseUrl = cmdOptions.baseUrl || config?.baseUrl;
        model = model || 'gpt-4o';
    }
    else if (provider === 'ollama') {
        baseUrl = cmdOptions.baseUrl || 'http://localhost:11434';
        model = model || 'llama3';
    }
    else if (provider === 'custom') {
        baseUrl = cmdOptions.baseUrl || config?.baseUrl || 'https://api.scnet.cn/api/llm/v1';
        apiKey = cmdOptions.apiKey || process.env.OPENAI_API_KEY;
        model = cmdOptions.model || config?.model || 'gpt-4o';
    }
    if (!apiKey && provider === 'custom') {
        if (!baseUrl) {
            log.red('Error: --base-url is required for custom provider');
            log.yellow('Example: --base-url https://api.scnet.cn/api/llm/v1');
            process.exit(1);
        }
        if (!apiKey) {
            log.red('Error: --api-key is required for custom provider');
            log.yellow('Example: --api-key your-api-key');
            process.exit(1);
        }
    }
    if (!apiKey && provider !== 'ollama' && provider !== 'custom') {
        log.yellow('No API key found. Set ANTHROPIC_API_KEY or OPENAI_API_KEY');
        log.yellow('Or use: --provider custom --api-key your-key --base-url https://api.scnet.cn/api/llm/v1');
        process.exit(1);
    }
    return { provider: provider, apiKey, baseUrl, model: model };
}
async function startChat(options) {
    log.blue('Enterprise CLI v1.0.0');
    log.gray('Starting chat session...\n');
    const cwd = options.cwd || process.cwd();
    const llmConfig = await getProviderConfig(options);
    const toolRegistry = new tools_1.ToolRegistry(cwd);
    const provider = (0, llm_1.createLLMProvider)(llmConfig);
    if ('setTools' in provider) {
        provider.setTools(toolRegistry.getOpenAIFormat());
    }
    const mode = (options.mode || 'default');
    const permissionGate = new gate_1.PermissionGate({ mode, rules: {} });
    const agent = new orchestrator_1.AgentOrchestrator({
        provider,
        toolRegistry,
        permissionGate,
        cwd,
        maxIterations: 100,
    });
    await agent.initialize();
    log.green('Ready!');
    log.gray(`Provider: ${llmConfig.provider}`);
    log.gray(`Model: ${llmConfig.model}`);
    log.gray(`Permission mode: ${permissionGate.getModeDescription()}`);
    log.gray(`Working directory: ${cwd}\n`);
    const readline = await Promise.resolve().then(() => __importStar(require('readline')));
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    const ask = () => {
        rl.question('\x1b[32m\n> \x1b[0m', async (input) => {
            if (!input.trim()) {
                ask();
                return;
            }
            if (input === '/exit' || input === '/quit') {
                log.gray('Goodbye!');
                process.exit(0);
            }
            if (input === '/mode') {
                log.gray(`Current mode: ${permissionGate.getModeDescription()}`);
                ask();
                return;
            }
            if (input.startsWith('/mode ')) {
                const newMode = input.slice(6).trim();
                if (gate_1.PermissionGate.getAvailableModes().includes(newMode)) {
                    permissionGate.setMode(newMode);
                    log.green(`Permission mode set to: ${newMode}`);
                }
                else {
                    log.red(`Invalid mode. Available: ${gate_1.PermissionGate.getAvailableModes().join(', ')}`);
                }
                ask();
                return;
            }
            if (input === '/help') {
                log.gray(`
Commands:
  /mode          - Show current permission mode
  /mode <mode>   - Change permission mode (default, acceptEdits, plan, auto)
  /help          - Show this help
  /exit          - Exit the session
        `);
                ask();
                return;
            }
            try {
                const response = await agent.chat(input);
                log.white(response);
            }
            catch (error) {
                log.red(`Error: ${error.message}`);
            }
            ask();
        });
    };
    ask();
}
async function runOnce(prompt, options) {
    const cwd = options.cwd || process.cwd();
    const llmConfig = await getProviderConfig(options);
    const toolRegistry = new tools_1.ToolRegistry(cwd);
    const provider = (0, llm_1.createLLMProvider)(llmConfig);
    if ('setTools' in provider) {
        provider.setTools(toolRegistry.getOpenAIFormat());
    }
    const mode = (options.mode || 'default');
    const permissionGate = new gate_1.PermissionGate({ mode, rules: {} });
    const agent = new orchestrator_1.AgentOrchestrator({
        provider,
        toolRegistry,
        permissionGate,
        cwd,
        maxIterations: 50,
    });
    await agent.initialize();
    try {
        const response = await agent.chat(prompt);
        console.log(response);
    }
    catch (error) {
        log.red(`Error: ${error.message}`);
        process.exit(1);
    }
}
async function listSessions() {
    const { SessionManager } = await Promise.resolve().then(() => __importStar(require('./agent/session')));
    const manager = new SessionManager();
    const sessions = await manager.list();
    if (sessions.length === 0) {
        log.gray('No saved sessions');
        return;
    }
    log.blue('Saved Sessions:');
    for (const session of sessions) {
        const date = new Date(session.lastActivityAt).toLocaleString();
        log.white(`  ${session.id} - ${session.workingDirectory} (${date})`);
    }
}
async function showGovernance(options) {
    const { GovernanceService } = await Promise.resolve().then(() => __importStar(require('./permissions/governance')));
    const governance = new GovernanceService();
    if (options.approveTool) {
        await governance.approveTool(options.approveTool, 'admin');
        log.green(`Approved tool: ${options.approveTool}`);
        return;
    }
    log.blue('Tool Governance Status:');
    const configs = governance.getAllToolConfigs();
    for (const config of configs) {
        const status = config.isApproved ? log.green('✓') : log.yellow('⨯');
        const approval = config.requiresApproval ? '(requires approval)' : '';
        log.white(`  ${status} ${config.name} ${approval}`);
    }
    log.blue('\nRecent Audit Logs:');
    const logs = await governance.getAuditLogs(undefined, undefined, 10);
    for (const entry of logs) {
        const time = new Date(entry.timestamp).toLocaleString();
        const success = entry.success ? log.green('✓') : log.red('⨯');
        log.white(`  ${time} ${success} ${entry.action} ${entry.tool || ''}`);
    }
}
async function manageMCP(options) {
    const { MCPClient } = await Promise.resolve().then(() => __importStar(require('./tools/mcp')));
    const mcp = new MCPClient();
    if (options.add) {
        const parts = options.add.split(' ');
        if (parts.length < 2) {
            log.red('Usage: --add <name> <url> [api-key]');
            return;
        }
        const name = parts[0];
        const url = parts[1];
        const apiKey = parts[2];
        await mcp.addServer({
            name,
            baseUrl: url,
            apiKey,
            tools: [],
        });
        log.green(`Added MCP server: ${name}`);
        log.gray(`Tools available: ${mcp.listTools().join(', ')}`);
        return;
    }
    log.blue('MCP Servers:');
    const servers = mcp.listServers();
    if (servers.length === 0) {
        log.gray('  No servers configured');
    }
    else {
        for (const server of servers) {
            log.white(`  - ${server}`);
        }
    }
    log.blue('\nAvailable Tools:');
    const tools = mcp.listTools();
    for (const tool of tools) {
        log.white(`  - ${tool}`);
    }
}
async function listSkills() {
    const { SkillLoader } = await Promise.resolve().then(() => __importStar(require('./agent/skills')));
    const loader = new SkillLoader();
    await loader.load();
    const cwd = process.cwd();
    loader.loadProjectSkills(cwd);
    const skills = loader.getSkillList();
    if (skills.length === 0) {
        log.gray('No skills found');
        log.gray('Create skills in:');
        log.gray('  - ~/.claude/skills/<skill-name>/SKILL.md');
        log.gray('  - .claude/skills/<skill-name>/SKILL.md');
        return;
    }
    log.blue('Available Skills:');
    for (const skill of skills) {
        log.white(`  - ${skill.name}: ${skill.description}`);
    }
    log.gray('\nTo use a skill, just mention it in your prompt.');
    log.gray('Example: "Use the pdf skill to extract text from document.pdf"');
}
//# sourceMappingURL=cli.js.map