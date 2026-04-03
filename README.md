# Enterprise CLI

An enterprise-grade AI coding assistant inspired by Claude Code architecture.

## Features

- **Multi-Provider LLM Support**: Anthropic Claude, OpenAI GPT, Ollama (local)
- **6 Core Tools**: Read, Edit, Write, Bash, Grep, Glob
- **Permission Modes**: default (read-only), acceptEdits, plan, auto, bypassPermissions
- **Context Management**: CLAUDE.md loading, context compaction
- **Interactive CLI**: Commander.js based command interface

## Architecture

Based on deep research into Claude Code's architecture:

```
┌─────────────────────────────────────────────────────┐
│  CLI Interface (Commander.js)                      │
├─────────────────────────────────────────────────────┤
│  Agent Orchestrator                                │
│  - Agent loop: prompt → model → tools → repeat     │
│  - Context assembly                                │
├─────────────────────────────────────────────────────┤
│  Tools (Read, Edit, Write, Bash, Grep, Glob)       │
├─────────────────────────────────────────────────────┤
│  Permission Gate                                   │
│  - default: read-only                              │
│  - acceptEdits: read + edit                        │
│  - plan: read + plan (no edits)                    │
│  - auto: all actions + safety                      │
├─────────────────────────────────────────────────────┤
│  LLM Provider Layer                                │
│  - Anthropic, OpenAI, Ollama                       │
└─────────────────────────────────────────────────────┘
```

## Installation

```bash
git clone <this-repo>
cd enterprise-cli
npm install
npm run build
```

## Configuration

### Environment Variables

```bash
# For Anthropic (default)
export ANTHROPIC_API_KEY=sk-ant-...

# For OpenAI
export OPENAI_API_KEY=sk-...

# For Ollama (local)
# Just run `ollama serve` on port 11434
```

### Config File

Create `.enterprise-cli.json` in your project:

```json
{
  "defaultProvider": "anthropic",
  "defaultModel": "claude-sonnet-4-20250514",
  "defaultPermissionMode": "default"
}
```

## Usage

### Interactive Chat

```bash
npm start -- chat
# or
npx ts-node src/index.ts chat
```

### Single Prompt

```bash
npm start -- run "Explain what this project does"
```

### Options

```bash
-m, --model <model>     Model to use
-p, --provider <provider>  Provider (anthropic|openai|ollama)
-c, --cwd <directory>   Working directory
--mode <mode>           Permission mode (default|acceptEdits|plan|auto)
```

## Permission Modes

| Mode | Read | Edit | Execute | Use Case |
|------|------|------|---------|----------|
| default | ✓ | ✗ | ✗ | Sensitive work, first use |
| acceptEdits | ✓ | ✓ | ✗ | Iterating on code |
| plan | ✓ | ✗ | ✓ | Research and design |
| auto | ✓ | ✓ | ✓ | Long-running tasks |
| bypassPermissions | ✓ | ✓ | ✓ | Isolated containers only |

## CLAUDE.md

Enterprise CLI supports CLAUDE.md files for project-specific instructions:

- `~/.claude/CLAUDE.md` - Global (all projects)
- `./CLAUDE.md` - Project (shared)
- `./CLAUDE.local.md` - Local (personal)
- Parent directory CLAUDE.md files are also loaded

## Tools

### Read
Reads file contents. Supports limit and offset.

### Edit
Makes targeted edits to files using oldString/newString replacement.

### Write
Creates or overwrites files.

### Bash
Executes shell commands. Working directory persists, environment variables don't.

### Glob
Fast file pattern matching.

### Grep
Fast content search using regex.

## Claude Code Patterns Implemented

1. **CLAUDE.md in user messages**: Injected into user messages, not system prompt, every turn
2. **Context refresh**: Re-sent every turn for 92% prompt caching
3. **Tool definitions**: Sent to model with name, description, input_schema
4. **Agent loop**: prompt → model → tool_calls → execute → repeat until end_turn
5. **Permission modes**: Read-only by default, explicit permission for edits

## License

MIT
