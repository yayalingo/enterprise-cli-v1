import { Command } from 'commander';
import { existsSync, mkdirSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { AgentOrchestrator } from './agent/orchestrator';
import { ToolRegistry } from './tools';
import { PermissionGate } from './permissions/gate';
import { createLLMProvider } from './providers/llm';
import type { LLMConfig, PermissionMode } from './agent/types';

const log = {
  blue: (s: string) => console.log('\x1b[36m' + s + '\x1b[0m'),
  gray: (s: string) => console.log('\x1b[90m' + s + '\x1b[0m'),
  green: (s: string) => console.log('\x1b[32m' + s + '\x1b[0m'),
  red: (s: string) => console.log('\x1b[31m' + s + '\x1b[0m'),
  white: (s: string) => console.log(s),
  yellow: (s: string) => console.log('\x1b[33m' + s + '\x1b[0m'),
};

const program = new Command();

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
  .command('tui')
  .description('Start TUI interface')
  .action(async (options) => {
    await startTUI({ ...program.opts(), ...options });
  });

program
  .command('web')
  .description('Start Web GUI')
  .option('-p, --port <port>', 'Port number', '3000')
  .action(async (options) => {
    await startWeb({ ...program.opts(), ...options });
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

program
  .command('workflow')
  .description('Manage workflows')
  .option('--design <description>', 'Design workflow from description')
  .option('--list', 'List workflows')
  .option('--run <id>', 'Run workflow by ID')
  .option('--docs <path>', 'Ingest documents for context')
  .action(async (options) => {
    if (options.design) {
      await designWorkflow(options.design);
    } else if (options.list) {
      await listWorkflows();
    } else if (options.run) {
      await runWorkflow(options.run);
    } else if (options.docs) {
      await ingestDocs(options.docs);
    }
  });

program.parse();

async function loadConfig() {
  const configPaths = [
    join(process.env.HOME || '', '.enterprise-cli', 'config.json'),
    join(process.cwd(), '.enterprise-cli.json'),
  ];

  for (const path of configPaths) {
    if (existsSync(path)) {
      try {
        const content = await readFile(path, 'utf-8');
        return JSON.parse(content);
      } catch {
      }
    }
  }

  return null;
}

async function getProviderConfig(cmdOptions: any): Promise<LLMConfig> {
  const config = await loadConfig();

  const provider = cmdOptions.provider || config?.defaultProvider || 'anthropic';
  let apiKey: string | undefined;
  let baseUrl: string | undefined;
  let model = cmdOptions.model || config?.defaultModel;

  if (provider === 'anthropic') {
    apiKey = cmdOptions.apiKey || process.env.ANTHROPIC_API_KEY;
    model = model || 'claude-sonnet-4-20250514';
  } else if (provider === 'openai') {
    apiKey = cmdOptions.apiKey || process.env.OPENAI_API_KEY;
    baseUrl = cmdOptions.baseUrl || config?.baseUrl;
    model = model || 'gpt-4o';
  } else if (provider === 'ollama') {
    baseUrl = cmdOptions.baseUrl || 'http://localhost:11434';
    model = model || 'llama3';
  } else if (provider === 'custom') {
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

  return { provider: provider as any, apiKey, baseUrl, model: model! };
}

async function startChat(options: any) {
  log.blue('Enterprise CLI v1.0.0');
  log.gray('Starting chat session...\n');

  const cwd = options.cwd || process.cwd();
  const llmConfig = await getProviderConfig(options);
  const toolRegistry = new ToolRegistry(cwd);
  
  const provider = createLLMProvider(llmConfig);
  if ('setTools' in provider) {
    (provider as any).setTools(toolRegistry.getOpenAIFormat());
  }

  const mode = (options.mode || 'default') as PermissionMode;
  const permissionGate = new PermissionGate({ mode, rules: {} });

  const agent = new AgentOrchestrator({
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

  const readline = await import('readline');
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
        const newMode = input.slice(6).trim() as PermissionMode;
        if (PermissionGate.getAvailableModes().includes(newMode)) {
          permissionGate.setMode(newMode);
          log.green(`Permission mode set to: ${newMode}`);
        } else {
          log.red(`Invalid mode. Available: ${PermissionGate.getAvailableModes().join(', ')}`);
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
      } catch (error: any) {
        log.red(`Error: ${error.message}`);
      }

      ask();
    });
  };

  ask();
}

async function runOnce(prompt: string, options: any) {
  const cwd = options.cwd || process.cwd();
  const llmConfig = await getProviderConfig(options);
  const toolRegistry = new ToolRegistry(cwd);
  
  const provider = createLLMProvider(llmConfig);
  if ('setTools' in provider) {
    (provider as any).setTools(toolRegistry.getOpenAIFormat());
  }

  const mode = (options.mode || 'default') as PermissionMode;
  const permissionGate = new PermissionGate({ mode, rules: {} });

  const agent = new AgentOrchestrator({
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
  } catch (error: any) {
    log.red(`Error: ${error.message}`);
    process.exit(1);
  }
}

async function listSessions(): Promise<void> {
  const { SessionManager } = await import('./agent/session');
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

async function showGovernance(options: any): Promise<void> {
  const { GovernanceService } = await import('./permissions/governance');
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

async function manageMCP(options: any): Promise<void> {
  const { MCPClient } = await import('./tools/mcp');
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
  } else {
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

async function listSkills(): Promise<void> {
  const { SkillLoader } = await import('./agent/skills');
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

async function startTUI(options: any): Promise<void> {
  log.blue('Starting TUI mode...\n');

  const cwd = options.cwd || process.cwd();
  const llmConfig = await getProviderConfig(options);
  const toolRegistry = new ToolRegistry(cwd);
  
  const provider = createLLMProvider(llmConfig);
  if ('setTools' in provider) {
    (provider as any).setTools(toolRegistry.getOpenAIFormat());
  }

  const mode = (options.mode || 'default') as PermissionMode;

  const { TUIManager } = await import('./tui');
  const tui = new TUIManager({
    provider,
    cwd,
    model: llmConfig.model!,
    permissionMode: mode,
  });

  await tui.start();
}

async function startWeb(options: any): Promise<void> {
  log.blue('Starting Web GUI...\n');

  const cwd = options.cwd || process.cwd();
  const llmConfig = await getProviderConfig(options);
  const port = parseInt(options.port) || 3000;

  log.green(`🌐 Web GUI will be available at http://localhost:${port}`);

  const { WebManager } = await import('./web');
  const web = new WebManager({
    llmConfig,
    cwd,
    permissionMode: (options.mode || 'default') as PermissionMode,
    port,
  });

  web.start(port);
}

async function designWorkflow(description: string): Promise<void> {
  log.blue('Designing workflow...');
  log.gray(`Description: ${description}\n`);

  const { workflowDesigner } = await import('./workflow');
  const result = await workflowDesigner.design({ description });

  log.green(`✓ Created workflow: ${result.workflow.name}`);
  log.gray(`  Nodes: ${result.workflow.nodes.length}`);
  log.gray(`  Confidence: ${Math.round(result.confidence * 100)}%`);

  if (result.suggestions.length > 0) {
    log.yellow('\nSuggestions:');
    result.suggestions.forEach(s => log.gray(`  - ${s}`));
  }

  if (result.missingNodes.length > 0) {
    log.red('\nUnknown steps:');
    result.missingNodes.forEach(n => log.gray(`  - ${n}`));
  }

  await (async () => {
    const path = join(process.env.HOME || '', '.enterprise-cli', 'workflows', `${result.workflow.id}.json`);
    if (!existsSync(join(process.env.HOME || '', '.enterprise-cli', 'workflows'))) {
      mkdirSync(join(process.env.HOME || '', '.enterprise-cli', 'workflows'), { recursive: true });
    }
    await writeFile(path, JSON.stringify(result.workflow, null, 2));
    log.green(`\nSaved to: ${path}`);
  })();
}

async function listWorkflows(): Promise<void> {
  const workflowsDir = join(process.env.HOME || '', '.enterprise-cli', 'workflows');
  
  if (!existsSync(workflowsDir)) {
    log.yellow('No workflows found');
    return;
  }

  const files = await import('fs').then(fs => fs.promises.readdir(workflowsDir));
  const workflows = files.filter(f => f.endsWith('.json'));

  if (workflows.length === 0) {
    log.yellow('No workflows found');
    return;
  }

  log.blue(`Found ${workflows.length} workflow(s):\n`);
  for (const file of workflows) {
    const content = await readFile(join(workflowsDir, file), 'utf-8');
    const wf = JSON.parse(content);
    log.white(`  ${wf.id}: ${wf.name} (${wf.nodes.length} nodes)`);
  }
}

async function runWorkflow(id: string): Promise<void> {
  log.blue(`Running workflow: ${id}...`);

  const path = join(process.env.HOME || '', '.enterprise-cli', 'workflows', `${id}.json`);
  if (!existsSync(path)) {
    log.red(`Workflow ${id} not found`);
    return;
  }

  const content = await readFile(path, 'utf-8');
  const workflow = JSON.parse(content);

  const { WorkflowExecutor } = await import('./workflow');
  const executor = new WorkflowExecutor();
  await executor.initialize();

  const result = await executor.execute(workflow);

  log.green(`\nExecution ${result.id}:`);
  log.gray(`  Status: ${result.status}`);
  log.gray(`  Nodes executed: ${Object.keys(result.nodeResults).length}`);
  
  if (result.error) {
    log.red(`  Error: ${result.error}`);
  }
}

async function ingestDocs(path: string): Promise<void> {
  log.blue(`Ingesting documents from: ${path}`);

  const { DocumentIngestion } = await import('./workflow');
  const docs = new DocumentIngestion();
  await docs.initialize();

  const isDir = existsSync(path) && (await import('fs').then(fs => fs.statSync(path))).isDirectory();
  
  if (isDir) {
    const ingested = await docs.ingestDirectory(path);
    log.green(`✓ Ingested ${ingested.length} documents`);
  } else {
    const doc = await docs.ingestFile(path);
    log.green(`✓ Ingested: ${doc.name}`);
  }
}
