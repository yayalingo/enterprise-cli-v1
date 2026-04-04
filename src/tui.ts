import blessed from 'blessed';
import { AgentOrchestrator } from './agent/orchestrator';
import { ToolRegistry } from './tools';
import { PermissionGate } from './permissions/gate';
import { createLLMProvider } from './providers/llm';
import type { PermissionMode } from './agent/types';

export interface TUIConfig {
  provider: any;
  cwd: string;
  model: string;
  permissionMode: PermissionMode;
}

export class TUIManager {
  private screen: any;
  private agent: AgentOrchestrator;
  private input: any;
  private output: any;
  private statusBar: any;
  private loading: boolean = false;

  constructor(config: TUIConfig) {
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Enterprise CLI',
    });

    const toolRegistry = new ToolRegistry(config.cwd);
    const permissionGate = new PermissionGate({ mode: config.permissionMode, rules: {} });
    
    const provider = config.provider;
    if ('setTools' in provider) {
      (provider as any).setTools(toolRegistry.getOpenAIFormat());
    }

    this.agent = new AgentOrchestrator({
      provider,
      toolRegistry,
      permissionGate,
      cwd: config.cwd,
      maxIterations: 100,
    });

    this.setupUI();
  }

  private setupUI(): void {
    const statusBar = blessed.box({
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      style: {
        fg: 'white',
        bg: 'blue',
      },
      content: ' Enterprise CLI - Press Ctrl+C to exit | /help for commands ',
    });

    const outputBox = blessed.box({
      top: 3,
      left: 0,
      width: '100%',
      height: '80%',
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: 'blue',
        },
      },
      label: ' Output ',
      scrollable: true,
      alwaysScroll: true,
    });

    const inputLine = blessed.box({
      bottom: 0,
      left: 0,
      width: '100%',
      height: 1,
      style: {
        fg: 'green',
        bg: 'black',
      },
      content: ' > ',
    });

    const input = blessed.textarea({
      bottom: 0,
      left: 2,
      width: '98%',
      height: 3,
      style: {
        fg: 'white',
        bg: 'black',
      },
      inputOnFocus: true,
    });

    const form = blessed.form({
      bottom: 0,
      left: 0,
      width: '100%',
      height: 3,
      keys: true,
      style: {
        fg: 'white',
        bg: 'black',
      },
    });

    form.append(inputLine);
    form.append(input);

    this.screen.append(statusBar);
    this.screen.append(outputBox);
    this.screen.append(form);

    this.statusBar = statusBar;
    this.output = outputBox;
    this.input = input;

    this.output.setContent('Welcome to Enterprise CLI!\n\n');
    this.output.setContent(this.output.getContent() + 'Type your message and press Enter to send.\n');
    this.output.setContent(this.output.getContent() + 'Commands:\n');
    this.output.setContent(this.output.getContent() + '  /help - Show help\n');
    this.output.setContent(this.output.getContent() + '  /clear - Clear output\n');
    this.output.setContent(this.output.getContent() + '  /mode - Show permission mode\n');
    this.output.setContent(this.output.getContent() + '  /quit - Exit\n\n');

    input.focus();
    this.screen.render();

    input.on('submit', async (value: string) => {
      if (!value.trim()) {
        this.screen.render();
        return;
      }

      await this.handleInput(value);
      input.clearValue();
      this.screen.render();
    });

    this.screen.key(['C-c'], () => {
      process.exit(0);
    });

    this.screen.key(['C-l'], () => {
      this.output.setContent('');
      this.screen.render();
    });
  }

  private async handleInput(value: string): Promise<void> {
    if (value === '/help') {
      this.appendOutput('Commands:\n');
      this.appendOutput('  /help - Show this help\n');
      this.appendOutput('  /clear - Clear output\n');
      this.appendOutput('  /mode - Show permission mode\n');
      this.appendOutput('  /quit - Exit\n');
      return;
    }

    if (value === '/clear') {
      this.output.setContent('');
      return;
    }

    if (value === '/mode') {
      this.appendOutput(`Permission mode: ${this.agent.getPermissionMode()}\n`);
      return;
    }

    if (value === '/quit' || value === '/exit') {
      process.exit(0);
    }

    this.appendOutput(`\n> ${value}\n`);
    this.loading = true;
    this.updateStatus('Thinking...');

    try {
      const response = await this.agent.chat(value);
      this.appendOutput(`\n${response}\n`);
    } catch (error: any) {
      this.appendOutput(`\nError: ${error.message}\n`);
    }

    this.loading = false;
    this.updateStatus('Ready');
  }

  private appendOutput(text: string): void {
    const current = this.output.getContent();
    this.output.setContent(current + text);
    this.output.scrollTo(1000);
    this.screen.render();
  }

  private updateStatus(text: string): void {
    this.statusBar.setContent(` Enterprise CLI - ${text} | /help for commands `);
    this.screen.render();
  }

  async start(): Promise<void> {
    await this.agent.initialize();
    this.updateStatus('Ready');
    this.screen.render();
  }
}
