import express from 'express';
import { AgentOrchestrator } from './agent/orchestrator';
import { ToolRegistry } from './tools';
import { PermissionGate } from './permissions/gate';
import { createLLMProvider } from './providers/llm';
import { AuditLogger } from './agent/audit';
import type { PermissionMode, LLMConfig } from './agent/types';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

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
  <title>Enterprise CLI</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-primary: #0a0a0f;
      --bg-secondary: #12121a;
      --bg-tertiary: #1a1a24;
      --bg-hover: #22222e;
      --accent: #6366f1;
      --accent-hover: #818cf8;
      --accent-green: #10b981;
      --accent-red: #ef4444;
      --accent-orange: #f59e0b;
      --text-primary: #f1f5f9;
      --text-secondary: #94a3b8;
      --text-muted: #64748b;
      --border: #2a2a3a;
      --shadow: 0 4px 20px rgba(0,0,0,0.4);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: 'DM Sans', -apple-system, sans-serif;
      background: var(--bg-primary); color: var(--text-primary); 
      height: 100vh; display: flex; flex-direction: column;
      overflow: hidden;
    }
    
    /* Header */
    header { 
      background: var(--bg-secondary); padding: 14px 24px; 
      border-bottom: 1px solid var(--border);
      display: flex; justify-content: space-between; align-items: center;
      backdrop-filter: blur(10px);
    }
    .logo { 
      display: flex; align-items: center; gap: 12px; 
      font-weight: 700; font-size: 18px; 
    }
    .logo-icon {
      width: 32px; height: 32px;
      background: linear-gradient(135deg, var(--accent), #a855f7);
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      font-size: 16px;
    }
    .header-controls { display: flex; gap: 12px; align-items: center; }
    .select-wrap {
      position: relative;
    }
    select { 
      appearance: none; background: var(--bg-tertiary); border: 1px solid var(--border);
      color: var(--text-primary); padding: 8px 32px 8px 12px; 
      border-radius: 8px; font-size: 13px; cursor: pointer;
      transition: all 0.2s;
    }
    select:hover { border-color: var(--accent); }
    select:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(99,102,241,0.2); }
    .select-wrap::after {
      content: '▾'; position: absolute; right: 12px; top: 50%;
      transform: translateY(-50%); pointer-events: none; color: var(--text-muted);
    }

    /* Main Layout */
    .main { display: flex; flex: 1; overflow: hidden; }
    
    /* Sidebar */
    .sidebar {
      width: 240px; background: var(--bg-secondary); 
      border-right: 1px solid var(--border); 
      padding: 16px; overflow-y: auto;
      display: flex; flex-direction: column; gap: 20px;
    }
    .sidebar-section h4 {
      font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;
      color: var(--text-muted); margin-bottom: 10px; font-weight: 600;
    }
    .tool-item {
      display: flex; align-items: center; gap: 10px; padding: 10px 12px;
      border-radius: 8px; font-size: 13px; color: var(--text-secondary);
      transition: all 0.15s; cursor: pointer;
    }
    .tool-item:hover { background: var(--bg-hover); color: var(--text-primary); }
    .tool-icon { font-size: 14px; }
    .new-chat-btn {
      background: var(--accent); color: white; border: none;
      padding: 12px; border-radius: 10px; font-size: 14px;
      font-weight: 600; cursor: pointer; transition: all 0.2s;
      display: flex; align-items: center; justify-content: center; gap: 8px;
    }
    .new-chat-btn:hover { background: var(--accent-hover); transform: translateY(-1px); }

    /* Chat Area */
    .chat-container {
      flex: 1; display: flex; flex-direction: column;
      background: var(--bg-primary);
    }
    #chat { 
      flex: 1; overflow-y: auto; padding: 24px; 
      display: flex; flex-direction: column; gap: 16px;
    }
    
    /* Messages */
    .message { 
      max-width: 80%; animation: fadeIn 0.3s ease; 
    }
    .message.user { align-self: flex-end; }
    .message.assistant { align-self: flex-start; }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .message-header {
      font-size: 12px; color: var(--text-muted); margin-bottom: 6px;
      display: flex; align-items: center; gap: 8px;
    }
    .message.user .message-header { justify-content: flex-end; }
    .message-role {
      font-weight: 500; text-transform: capitalize;
    }
    .message-time { color: var(--text-muted); }
    
    .message-content { 
      background: var(--bg-secondary); padding: 14px 18px; 
      border-radius: 16px; line-height: 1.6; font-size: 14px;
      border: 1px solid var(--border);
    }
    .message.user .message-content { 
      background: var(--accent); border-color: var(--accent);
      border-radius: 16px 16px 4px 16px;
    }
    .message-content code {
      font-family: 'JetBrains Mono', monospace;
      background: rgba(0,0,0,0.3); padding: 2px 6px; 
      border-radius: 4px; font-size: 13px;
    }
    .message-content pre {
      background: var(--bg-primary); padding: 12px; 
      border-radius: 8px; overflow-x: auto; margin: 8px 0;
    }
    
    /* Tool Call Indicator */
    .tool-call {
      background: var(--bg-tertiary); border: 1px solid var(--accent);
      padding: 10px 14px; border-radius: 10px; margin: 8px 0;
      font-family: 'JetBrains Mono', monospace; font-size: 12px;
      color: var(--accent);
    }
    .tool-result {
      background: var(--bg-tertiary); border-left: 3px solid var(--accent-green);
      padding: 10px 14px; border-radius: 0 8px 8px 0; margin: 8px 0;
      font-family: 'JetBrains Mono', monospace; font-size: 12px;
      max-height: 200px; overflow-y: auto;
    }
    .tool-error { border-color: var(--accent-red); color: var(--accent-red); }

    /* Typing */
    .typing {
      display: flex; gap: 4px; padding: 14px 18px;
      background: var(--bg-secondary); border-radius: 16px;
      width: fit-content;
    }
    .typing span {
      width: 8px; height: 8px; background: var(--text-muted);
      border-radius: 50%; animation: bounce 1.4s infinite ease-in-out;
    }
    .typing span:nth-child(1) { animation-delay: -0.32s; }
    .typing span:nth-child(2) { animation-delay: -0.16s; }
    
    @keyframes bounce {
      0%, 80%, 100% { transform: scale(0.6); }
      40% { transform: scale(1); }
    }

    /* Input Area */
    #input-area { 
      background: var(--bg-secondary); padding: 20px 24px; 
      border-top: 1px solid var(--border);
    }
    .input-wrapper {
      display: flex; gap: 12px; align-items: flex-end;
      background: var(--bg-tertiary); border: 1px solid var(--border);
      border-radius: 16px; padding: 12px 16px;
      transition: all 0.2s;
    }
    .input-wrapper:focus-within {
      border-color: var(--accent); box-shadow: 0 0 0 3px rgba(99,102,241,0.15);
    }
    #prompt { 
      flex: 1; background: transparent; border: none; color: var(--text-primary);
      font-size: 14px; font-family: inherit; resize: none;
      min-height: 24px; max-height: 150px; line-height: 1.5;
    }
    #prompt:focus { outline: none; }
    #prompt::placeholder { color: var(--text-muted); }
    #send { 
      background: var(--accent); color: white; border: none;
      padding: 10px 20px; border-radius: 10px; 
      cursor: pointer; font-weight: 600; font-size: 14px;
      transition: all 0.2s;
    }
    #send:hover:not(:disabled) { background: var(--accent-hover); }
    #send:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Tabs */
    .tabs { display: flex; gap: 4px; padding: 0 24px; background: var(--bg-secondary); border-bottom: 1px solid var(--border); }
    .tab {
      padding: 12px 16px; font-size: 13px; color: var(--text-muted);
      cursor: pointer; border-bottom: 2px solid transparent;
      transition: all 0.2s;
    }
    .tab:hover { color: var(--text-primary); }
    .tab.active { color: var(--accent); border-color: var(--accent); }

    /* Audit Panel */
    #audit-panel {
      display: none; padding: 20px; overflow-y: auto;
    }
    #audit-panel.active { display: block; }
    .audit-table {
      width: 100%; border-collapse: collapse;
    }
    .audit-table th, .audit-table td {
      padding: 12px; text-align: left;
      border-bottom: 1px solid var(--border);
    }
    .audit-table th {
      font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;
      color: var(--text-muted); font-weight: 600;
    }
    .audit-badge {
      padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 600;
    }
    .audit-badge.success { background: rgba(16,185,129,0.2); color: var(--accent-green); }
    .audit-badge.error { background: rgba(239,68,68,0.2); color: var(--accent-red); }
  </style>
</head>
<body>

<header>
  <div class="logo">
    <div class="logo-icon">🤖</div>
    <span>Enterprise CLI</span>
  </div>
  <div class="header-controls">
    <div class="select-wrap">
      <select id="model">
        <option value="Qwen3-235B-A22B-Thinking-2507">Qwen 3</option>
        <option value="gpt-4o">GPT-4o</option>
        <option value="claude-sonnet-4-20250514">Claude Sonnet</option>
      </select>
    </div>
    <div class="select-wrap">
      <select id="mode">
        <option value="default">Read Only</option>
        <option value="acceptEdits">Edit Files</option>
        <option value="plan">Plan Only</option>
        <option value="auto">Auto</option>
        <option value="bypassPermissions">Unrestricted</option>
      </select>
    </div>
  </div>
</header>

<div class="tabs">
  <div class="tab active" data-tab="chat">Chat</div>
  <div class="tab" data-tab="audit">Audit Log</div>
  <div class="tab" data-tab="session">Session</div>
</div>

<div class="main">
  <div class="sidebar">
    <button class="new-chat-btn" onclick="clearChat()">
      <span>➕</span> New Chat
    </button>
    
    <div class="sidebar-section">
      <h4>Tools</h4>
      <div class="tool-item"><span class="tool-icon">📖</span> Read</div>
      <div class="tool-item"><span class="tool-icon">✏️</span> Edit</div>
      <div class="tool-item"><span class="tool-icon">📝</span> Write</div>
      <div class="tool-item"><span class="tool-icon">⚡</span> Bash</div>
      <div class="tool-item"><span class="tool-icon">🌐</span> WebFetch</div>
      <div class="tool-item"><span class="tool-icon">🔍</span> WebSearch</div>
      <div class="tool-item"><span class="tool-icon">🧠</span> Agent</div>
    </div>
    
    <div class="sidebar-section">
      <h4>Session</h4>
      <div class="tool-item"><span class="tool-icon">📊</span> Cost: $0.00</div>
      <div class="tool-item"><span class="tool-icon">📝</span> Tokens: 0</div>
    </div>
  </div>
  
  <div class="chat-container">
    <div id="chat"></div>
    <div id="input-area">
      <div class="input-wrapper">
        <textarea id="prompt" placeholder="Message Enterprise CLI..." rows="1"></textarea>
        <button id="send">Send</button>
      </div>
    </div>
  </div>
</div>

<div id="audit-panel">
  <h3 style="margin-bottom: 16px;">Tool Execution Audit Log</h3>
  <table class="audit-table">
    <thead>
      <tr>
        <th>Time</th>
        <th>Tool</th>
        <th>Duration</th>
        <th>Status</th>
        <th>Input</th>
      </tr>
    </thead>
    <tbody id="audit-body"></tbody>
  </table>
</div>

<script>
const chat = document.getElementById('chat');
const prompt = document.getElementById('prompt');
const send = document.getElementById('send');
const model = document.getElementById('model');
const mode = document.getElementById('mode');
const tabs = document.querySelectorAll('.tab');
const auditPanel = document.getElementById('audit-panel');
const auditBody = document.getElementById('audit-body');

prompt.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const tabName = tab.dataset.tab;
    document.getElementById('chat').style.display = tabName === 'chat' ? 'flex' : 'none';
    document.getElementById('input-area').style.display = tabName === 'chat' ? 'flex' : 'none';
    auditPanel.classList.toggle('active', tabName === 'audit');
    if (tabName === 'audit') loadAudit();
  });
});

function addMessage(role, content, isHtml = false) {
  const div = document.createElement('div');
  div.className = 'message ' + role;
  const time = new Date().toLocaleTimeString();
  div.innerHTML = \`
    <div class="message-header">
      <span class="message-role">\${role}</span>
      <span class="message-time">\${time}</span>
    </div>
    <div class="message-content">\${isHtml ? content : escapeHtml(content)}</div>
  \`;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function addToolCall(name, input) {
  const div = document.createElement('div');
  div.className = 'tool-call';
  div.textContent = \`Tool: \${name} → \${JSON.stringify(input)}\`;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function addToolResult(content, isError = false) {
  const div = document.createElement('div');
  div.className = 'tool-result' + (isError ? ' tool-error' : '');
  div.textContent = content.substring(0, 500);
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function clearChat() {
  chat.innerHTML = '';
}

async function sendMessage() {
  const text = prompt.value.trim();
  if (!text) return;
  
  addMessage('user', text);
  prompt.value = '';
  send.disabled = true;
  
  const typing = document.createElement('div');
  typing.className = 'typing';
  typing.innerHTML = '<span></span><span></span><span></span>';
  chat.appendChild(typing);
  chat.scrollTop = chat.scrollHeight;
  
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, model: model.value, mode: mode.value })
    });
    const data = await res.json();
    chat.removeChild(typing);
    
    if (data.toolCalls) {
      data.toolCalls.forEach(tc => addToolCall(tc.name, tc.input));
    }
    if (data.toolResults) {
      data.toolResults.forEach(tr => addToolResult(tr.content, tr.is_error));
    }
    addMessage('assistant', data.response);
  } catch (e) {
    chat.removeChild(typing);
    addMessage('assistant', 'Error: ' + e.message);
  }
  
  send.disabled = false;
  prompt.focus();
}

async function loadAudit() {
  try {
    const res = await fetch('/api/audit');
    const entries = await res.json();
    auditBody.innerHTML = entries.map(e => \`
      <tr>
        <td>\${new Date(e.timestamp).toLocaleString()}</td>
        <td><code>\${e.tool || '-'}</code></td>
        <td>\${e.duration}ms</td>
        <td><span class="audit-badge \${e.success ? 'success' : 'error'}">\${e.success ? '✓' : '✗'}</span></td>
        <td><code style="font-size:11px">\${JSON.stringify(e.input || {}).substring(0, 50)}...</code></td>
      </tr>
    \`).join('');
  } catch (e) {
    auditBody.innerHTML = '<tr><td colspan="5">No audit entries</td></tr>';
  }
}
</script>
</body>
</html>
`;

export class WebManager {
  private app: express.Application;
  private agent!: AgentOrchestrator;
  private config: WebConfig;
  private sessionId: string;
  private auditLogger?: AuditLogger;

  constructor(config: WebConfig) {
    this.config = config;
    this.app = express();
    this.sessionId = `session_${Date.now()}`;
    
    this.app.use(express.json());
    
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

    this.auditLogger = new AuditLogger(this.sessionId, this.config.cwd);
    await this.auditLogger.initialize();
    
    const agent = new AgentOrchestrator({
      provider,
      toolRegistry,
      permissionGate,
      cwd: this.config.cwd,
      maxIterations: 100,
      enableSessionPersistence: true,
      auditLogger: this.auditLogger,
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
        
        if (!this.agent) {
          this.agent = await this.createAgent(model, mode);
        }

        const response = await this.agent.chat(message);
        
        const messages = this.agent.getMessages();
        const toolCalls: any[] = [];
        const toolResults: any[] = [];
        
        for (const msg of messages.slice(-20)) {
          if (msg.tool_calls) {
            msg.tool_calls.forEach((tc: any) => {
              toolCalls.push({ name: tc.name, input: tc.input });
            });
          }
          if (msg.role === 'tool' && msg.tool_use_id) {
            const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
            toolResults.push({ content, is_error: content.startsWith('Error') });
          }
        }
        
        await this.agent.flushAudit();
        
        res.json({ response, toolCalls, toolResults });
      } catch (error: any) {
        res.json({ response: `Error: ${error.message}`, toolCalls: [], toolResults: [] });
      }
    });

    this.app.get('/api/audit', async (req, res) => {
      if (!this.auditLogger) {
        return res.json([]);
      }
      
      const entries = this.auditLogger.getEntries();
      res.json(entries);
    });

    this.app.get('/api/cost', (req, res) => {
      if (!this.agent) {
        return res.json({ total: 0, tokens: 0 });
      }
      res.json({
        summary: this.agent.getCostSummary(),
      });
    });
  }

  start(port: number): void {
    this.app.listen(port, () => {
      console.log(`🌐 Web UI: http://localhost:${port}`);
    });
  }
}
