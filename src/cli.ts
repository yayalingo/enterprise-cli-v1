import { Command } from 'commander';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { AgentOrchestrator } from './agent/orchestrator';
import { ToolRegistry } from './tools';
import { PermissionGate } from './permissions/gate';
import { createLLMProvider } from './providers/llm';
import type { LLMConfig, PermissionMode } from './agent/types';

const program = new Command();

program
  .name('enterprise')
  .description('Enterprise CLI - AI coding assistant')
  .version('1.0.0');

program
  .command('chat')
  .description('Start an interactive chat session')
  .option('-m, --model <model>', 'Model to use', 'claude-sonnet-4-20250514')
  .option('-p, --provider <provider>', 'Provider (anthropic|openai|ollama|custom)', 'anthropic')
  .option('--base-url <url>', 'Custom API base URL (for custom provider)')
  .option('--api-key <key>', 'API key (for custom/openai provider)')
  .option('--mode <mode>', 'Permission mode (default|acceptEdits|plan|auto)', 'default')
  .option('-c, --cwd <directory>', 'Working directory', process.cwd())
  .action(async (options) => {
    await startChat(options);
  });

program
  .command('run')
  .description('Run a single prompt')
  .argument('<prompt>', 'Prompt to execute')
  .option('-m, --model <model>', 'Model to use')
  .option('-p, --provider <provider>', 'Provider')
  .option('--base-url <url>', 'Custom API base URL')
  .option('--api-key <key>', 'API key')
  .option('--mode <mode>', 'Permission mode')
  .option('-c, --cwd <directory>', 'Working directory')
  .action(async (prompt, options) => {
    await runOnce(prompt, options);
  });

program
  .option('-m, --model <model>', 'Model to use')
  .option('-p, --provider <provider>', 'Provider')
  .option('--base-url <url>', 'Custom API base URL')
  .option('--api-key <key>', 'API key')
  .option('--mode <mode>', 'Permission mode')
  .action(async () => {
    await startChat(program.opts());
  });

const log = {
  blue: (s: string) => console.log('\x1b[36m' + s + '\x1b[0m'),
  gray: (s: string) => console.log('\x1b[90m' + s + '\x1b[0m'),
  green: (s: string) => console.log('\x1b[32m' + s + '\x1b[0m'),
  red: (s: string) => console.log('\x1b[31m' + s + '\x1b[0m'),
  white: (s: string) => console.log(s),
  yellow: (s: string) => console.log('\x1b[33m' + s + '\x1b[0m'),
};

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

  if (!apiKey && provider !== 'ollama') {
    log.yellow('No API key found. Set ANTHROPIC_API_KEY or OPENAI_API_KEY, or use --api-key');
    log.yellow('Usage: export ANTHROPIC_API_KEY=sk-ant-...');
    log.yellow('Or: enterprise chat --provider custom --api-key your-key --base-url https://api.scnet.cn/api/llm/v1');
    process.exit(1);
  }

  return { provider: provider as any, apiKey, baseUrl, model: model! };
}

async function startChat(options: any) {
  log.blue('Enterprise CLI v1.0.0');
  log.gray('Starting chat session...\n');

  const cwd = options.cwd || process.cwd();
  const llmConfig = await getProviderConfig(options);
  const provider = createLLMProvider(llmConfig);

  const toolRegistry = new ToolRegistry(cwd);

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
  log.gray(`Permission mode: ${permissionGate.getModeDescription()}`);
  log.gray(`Working directory: ${cwd}\n`);

  if (options.provider === 'ollama') {
    log.yellow('Note: Using Ollama - make sure it\'s running on localhost:11434\n');
  }

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
  const provider = createLLMProvider(llmConfig);

  const toolRegistry = new ToolRegistry(cwd);
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

function join(...paths: string[]): string {
  return paths.join('/').replace(/\/+/g, '/');
}

program.parse();
