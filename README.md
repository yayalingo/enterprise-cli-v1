# Enterprise CLI

An enterprise-grade AI coding assistant inspired by Claude Code architecture, with governance, session management, and MCP support.

## Features

- **Multi-Provider LLM Support**: Anthropic Claude, OpenAI, Ollama, Custom (SCNet, etc.)
- **6 Core Tools**: Read, Edit, Write, Bash, Grep, Glob
- **Permission Modes**: default (read-only), acceptEdits, plan, auto, bypassPermissions
- **Session Management**: Save/resume chat sessions
- **Governance & Audit**: RBAC, tool approval, audit logs
- **MCP Integration**: Connect to external MCP servers
- **CLAUDE.md Support**: Project-specific instructions

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  CLI Commands                                        │
│  chat | run | sessions | governance | mcp            │
├─────────────────────────────────────────────────────┤
│  Agent Orchestrator                                 │
│  - Agent loop: prompt → model → tools → repeat     │
│  - Session management                                │
│  - Context assembly                                  │
├─────────────────────────────────────────────────────┤
│  Tools (Core + MCP)                                 │
│  Read | Edit | Write | Bash | Grep | Glob | ...   │
├─────────────────────────────────────────────────────┤
│  Governance Layer                                    │
│  - Permission Gate (modes)                          │
│  - Audit Logging                                     │
│  - Tool Approval                                     │
├─────────────────────────────────────────────────────┤
│  LLM Provider Layer                                  │
│  Anthropic | OpenAI | Ollama | Custom               │
└─────────────────────────────────────────────────────┘
```

## Installation

```bash
git clone https://github.com/yayalingo/enterprise-cli-v1.git
cd enterprise-cli-v1
npm install
npm run build
```

## Quick Start

```bash
# Interactive chat with SCNet
npm start -- chat \
  --provider custom \
  --base-url https://api.scnet.cn/api/llm/v1 \
  --api-key YOUR_KEY \
  --model Qwen3-235B-A22B-Thinking-2507

# Single prompt
npm start -- run "Write hello to /tmp/hello.py" --mode acceptEdits
```

## Commands

### chat
Start interactive chat session.

```bash
npm start -- chat \
  --provider custom \
  --base-url https://api.scnet.cn/api/llm/v1 \
  --api-key YOUR_KEY \
  --model MODEL_NAME
```

### run
Run single prompt and exit.

```bash
npm start -- run "Explain this code" --mode default
```

### sessions
List saved sessions.

```bash
npm start -- sessions
```

### governance
Show tool approval status and audit logs.

```bash
npm start -- governance
npm start -- governance --approve-tool Write
```

### mcp
Manage MCP servers.

```bash
npm start -- mcp --add myserver https://mcp.example.com
```

## Options

| Option | Description |
|--------|-------------|
| `-m, --model` | Model to use |
| `-p, --provider` | Provider (anthropic/openai/ollama/custom) |
| `--base-url` | Custom API base URL |
| `--api-key` | API key |
| `--mode` | Permission mode (default/acceptEdits/plan/auto) |
| `-c, --cwd` | Working directory |

## Permission Modes

| Mode | Read | Edit | Execute | Use Case |
|------|------|------|---------|----------|
| default | ✓ | ✗ | ✗ | Sensitive work |
| acceptEdits | ✓ | ✓ | ✗ | Iterating on code |
| plan | ✓ | ✗ | ✓ | Research |
| auto | ✓ | ✓ | ✓ | Long-running tasks |
| bypassPermissions | ✓ | ✓ | ✓ | Isolated containers |

## CLAUDE.md

Enterprise CLI loads CLAUDE.md from:

- `~/.claude/CLAUDE.md` - Global
- `./CLAUDE.md` - Project
- `./CLAUDE.local.md` - Local
- Parent directories

## Tools

| Tool | Description |
|------|-------------|
| Read | Read file contents |
| Edit | Edit files (oldString/newString) |
| Write | Create/overwrite files |
| Bash | Execute shell commands |
| Glob | File pattern matching |
| Grep | Regex content search |

## Claude Code Patterns

1. **CLAUDE.md in user messages** - Not system prompt
2. **Context refresh** - Every turn for caching
3. **Tool definitions** - Sent to model
4. **Agent loop** - prompt → model → tools → end_turn
5. **Permission modes** - Read-only by default

## License

MIT
