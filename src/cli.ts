import { Command } from 'commander';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
import { AgentOrchestrator } from './agent/orchestrator';
import { ToolRegistry } from './tools';
import { PermissionGate } from './permissions/gate';
import { createLLMProvider } from './providers/llm';
import type { LLMConfig, PermissionMode } from './agent/types';
import chalk from 'chalk';
import inquirer from 'inquirer';

const program = new Command();

program
  .name('enterprise')
  .description('Enterprise CLI - AI coding assistant')
  .version('1.0.0');

program
  .command('chat')
  .description('Start an interactive chat session')
  .option('-m, --model <model>', 'Model to use', 'claude-sonnet-4-20250514')
  .option('-p, --provider <provider>', 'Provider (anthropic|openai|ollama)', 'anthropic')
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
  .option('--mode <mode>', 'Permission mode')
  .option('-c, --cwd <directory>', 'Working directory')
  .action(async (prompt, options) => {
    await runOnce(prompt, options);
  });

program
  .option('-m, --model <model>', 'Model to use')
  .option('-p, --provider <provider>', 'Provider')
  .option('--mode <mode>', 'Permission mode')
  .action(async () => {
    await startChat(program.opts());
  });

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
      } catch {}
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
    apiKey = process.env.ANTHROPIC_API_KEY;
    model = model || 'claude-sonnet-4-20250514';
  } else if (provider === 'openai') {
    apiKey = process.env.OPENAI_API_KEY;
    model = model || 'gpt-4o';
  } else if (provider === 'ollama') {
    baseUrl = 'http://localhost:11434';
    model = model || 'llama3';
  }

  if (!apiKey && provider !== 'ollama') {
    console.log(chalk.yellow('No API key found. Set ANTHROPIC_API_KEY or OPENAI_API_KEY'));
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'apiKey',
        message: `Enter ${provider} API key:`,
      },
    ]);
    apiKey = answers.apiKey;
  }

  return { provider: provider as any, apiKey, baseUrl, model: model! };
}

async function startChat(options: any) {
  console.log(chalk.blue('Enterprise CLI v1.0.0'));
  console.log(chalk.gray('Starting chat session...\n'));

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

  console.log(chalk.green('Ready!'));
  console.log(chalk.gray(`Permission mode: ${permissionGate.getModeDescription()}`));
  console.log(chalk.gray(`Working directory: ${cwd}\n`));

  if (options.provider === 'ollama') {
    console.log(chalk.yellow('Note: Using Ollama - make sure it\'s running on localhost:11434\n'));
  }

  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = () => {
    rl.question(chalk.green('\n> '), async (input) => {
      if (!input.trim()) {
        ask();
        return;
      }

      if (input === '/exit' || input === '/quit') {
        console.log(chalk.gray('Goodbye!'));
        process.exit(0);
      }

      if (input === '/mode') {
        console.log(chalk.gray(`Current mode: ${permissionGate.getModeDescription()}`));
        ask();
        return;
      }

      if (input.startsWith('/mode ')) {
        const newMode = input.slice(6).trim() as PermissionMode;
        if (PermissionGate.getAvailableModes().includes(newMode)) {
          permissionGate.setMode(newMode);
          console.log(chalk.green(`Permission mode set to: ${newMode}`));
        } else {
          console.log(chalk.red(`Invalid mode. Available: ${PermissionGate.getAvailableModes().join(', ')}`));
        }
        ask();
        return;
      }

      if (input === '/help') {
        console.log(chalk.gray(`
Commands:
  /mode          - Show current permission mode
  /mode <mode>   - Change permission mode (default, acceptEdits, plan, auto)
  /help          - Show this help
  /exit          - Exit the session
        `));
        ask();
        return;
      }

      try {
        const response = await agent.chat(input);
        console.log(chalk.white(response));
      } catch (error: any) {
        console.log(chalk.red(`Error: ${error.message}`));
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
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

program.parse();
