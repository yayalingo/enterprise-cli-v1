import express from 'express';
import { AgentOrchestrator } from './agent/orchestrator';
import { ToolRegistry } from './tools';
import { PermissionGate } from './permissions/gate';
import { createLLMProvider } from './providers/llm';
import type { PermissionMode, LLMConfig } from './agent/types';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

export interface WebConfig {
  llmConfig: LLMConfig;
  cwd: string;
  permissionMode: PermissionMode;
  port?: number;
}

const HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Enterprise CLI - AI Coding Assistant</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
      background: #0d1117; color: #c9d1d9; height: 100vh; display: flex; flex-direction: column;
    }
    header { 
      background: #161b22; padding: 12px 20px; border-bottom: 1px solid #30363d;
      display: flex; justify-content: space-between; align-items: center;
    }
    header h1 { font-size: 18px; color: #58a6ff; }
    .config { display: flex; gap: 10px; align-items: center; }
    .config select, .config input { 
      background: #0d1117; border: 1px solid #30363d; color: #c9d1d9;
      padding: 6px 10px; border-radius: 6px; font-size: 13px;
    }
    #chat { flex: 1; overflow-y: auto; padding: 20px; }
    .message { margin-bottom: 16px; max-width: 85%; }
    .message.user { margin-left: auto; }
    .message .role { font-size: 11px; color: #8b949e; margin-bottom: 4px; }
    .message.user .role { text-align: right; }
    .message .content { 
      background: #161b22; padding: 12px 16px; border-radius: 8px; line-height: 1.5; white-space: pre-wrap;
    }
    .message.user .content { background: #1f6feb; }
    .message.assistant .content { border: 1px solid #30363d; }
    .typing { color: #8b949e; font-style: italic; }
    #input-area { 
      background: #161b22; padding: 16px 20px; border-top: 1px solid #30363d;
      display: flex; gap: 12px;
    }
    #prompt { 
      flex: 1; background: #0d1117; border: 1px solid #30363d; color: #c9d1d9;
      padding: 12px 16px; border-radius: 8px; font-size: 14px; font-family: inherit;
      resize: none; min-height: 50px;
    }
    #prompt:focus { outline: none; border-color: #58a6ff; }
    #send { 
      background: #238636; color: white; border: none; padding: 12px 24px;
      border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600;
    }
    #send:hover { background: #2ea043; }
    #send:disabled { background: #30363d; cursor: not-allowed; }
    .sidebar {
      width: 220px; background: #161b22; border-right: 1px solid #30363d; padding: 16px;
    }
    .sidebar h3 { font-size: 12px; color: #8b949e; text-transform: uppercase; margin-bottom: 12px; }
    .sidebar-item { 
      padding: 8px 12px; border-radius: 6px; cursor: pointer; margin-bottom: 4px; font-size: 13px;
    }
    .sidebar-item:hover { background: #21262d; }
    .main-container { display: flex; flex: 1; height: calc(100vh - 60px); }
    code { background: #21262d; padding: 2px 6px; border-radius: 4px; }
    pre { background: #21262d; padding: 12px; border-radius: 8px; overflow-x: auto; }
  </style>
</head>
<body>
  <header>
    <h1>🤖 Enterprise CLI</h1>
    <div class="config">
      <select id="model">
        <option value="Qwen3-235B-A22B-Thinking-2507">Qwen3-235B</option>
        <option value="gpt-4o">GPT-4o</option>
        <option value="claude-sonnet-4-20250514">Claude Sonnet</option>
      </select>
      <select id="mode">
        <option value="default">Read Only</option>
        <option value="acceptEdits">Accept Edits</option>
        <option value="plan">Plan</option>
        <option value="auto">Auto</option>
      </select>
    </div>
  </header>
  <div class="main-container">
    <div class="sidebar">
      <h3>Tools</h3>
      <div class="sidebar-item">📖 Read</div>
      <div class="sidebar-item">✏️ Edit</div>
      <div class="sidebar-item">📝 Write</div>
      <div class="sidebar-item">⚡ Bash</div>
      <div class="sidebar-item">🔍 Grep</div>
      <div class="sidebar-item">📁 Glob</div>
      <h3 style="margin-top: 20px;">Skills</h3>
      <div class="sidebar-item">📊 CSV</div>
      <div class="sidebar-item">📄 PDF</div>
    </div>
    <div style="flex:1; display:flex; flex-direction:column;">
      <div id="chat"></div>
      <div id="input-area">
        <textarea id="prompt" placeholder="Type your message... (Shift+Enter for new line, Enter to send)"></textarea>
        <button id="send">Send</button>
      </div>
    </div>
  </div>
  <script>
    const chat = document.getElementById('chat');
    const prompt = document.getElementById('prompt');
    const send = document.getElementById('send');
    const model = document.getElementById('model');
    const mode = document.getElementById('mode');

    let history = [];

    function addMessage(role, content) {
      const div = document.createElement('div');
      div.className = 'message ' + role;
      div.innerHTML = '<div class="role">' + role + '</div><div class="content">' + escapeHtml(content) + '</div>';
      chat.appendChild(div);
      chat.scrollTop = chat.scrollHeight;
    }

    function escapeHtml(text) {
      return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    async function sendMessage() {
      const text = prompt.value.trim();
      if (!text) return;

      addMessage('user', text);
      prompt.value = '';
      send.disabled = true;

      const typing = document.createElement('div');
      typing.className = 'message assistant';
      typing.innerHTML = '<div class="role">assistant</div><div class="content typing">Thinking...</div>';
      chat.appendChild(typing);
      chat.scrollTop = chat.scrollHeight;

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            message: text, 
            model: model.value,
            mode: mode.value
          })
        });
        const data = await res.json();
        chat.removeChild(typing);
        addMessage('assistant', data.response);
      } catch (e) {
        chat.removeChild(typing);
        addMessage('assistant', 'Error: ' + e.message);
      }

      send.disabled = false;
      prompt.focus();
    }

    send.onclick = sendMessage;
    prompt.onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    };

    prompt.focus();
  </script>
</body>
</html>
`;

export class WebManager {
  private app: express.Application;
  private agent!: AgentOrchestrator;
  private config: WebConfig;

  constructor(config: WebConfig) {
    this.config = config;
    this.app = express();
    this.app.use(express.json());
    this.app.use(express.static(join(__dirname, '..', 'public')));
    
    this.setupRoutes();
  }

  private async createAgent(model: string, mode: string): Promise<AgentOrchestrator> {
    const toolRegistry = new ToolRegistry(this.config.cwd);
    const permissionGate = new PermissionGate({ mode: mode as PermissionMode, rules: {} });
    
    const llmConfig = { ...this.config.llmConfig, model };
    const provider = createLLMProvider(llmConfig);
    
    if ('setTools' in provider) {
      (provider as any).setTools(toolRegistry.getOpenAIFormat());
    }

    const agent = new AgentOrchestrator({
      provider,
      toolRegistry,
      permissionGate,
      cwd: this.config.cwd,
      maxIterations: 100,
    });

    await agent.initialize();
    return agent;
  }

  private setupRoutes(): void {
    this.app.get('/', (req, res) => {
      res.send(HTML);
    });

    this.app.post('/api/chat', async (req, res) => {
      try {
        const { message, model, mode } = req.body;
        
        if (!message) {
          res.status(400).json({ error: 'Message is required' });
          return;
        }

        const agent = await this.createAgent(model || 'Qwen3-235B-A22B-Thinking-2507', mode || 'default');
        const response = await agent.chat(message);
        
        res.json({ response });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/health', (req, res) => {
      res.json({ status: 'ok' });
    });
  }

  start(port?: number): void {
    const p = port || this.config.port || 3000;
    this.app.listen(p, () => {
      console.log(`🌐 Web GUI available at http://localhost:${p}`);
    });
  }
}
