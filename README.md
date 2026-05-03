# MCP DevKit

> **One MCP server to rule them all.**
>
> Stop installing 10 separate MCP servers. This one does it all — and actually works on Windows.

MCP DevKit is a unified [Model Context Protocol](https://modelcontextprotocol.io) server that gives your AI:

- **Project Intelligence** — auto-detects tech stack, frameworks, entry points
- **Persistent Memory** — remembers facts, TODOs, and decisions across sessions
- **Cross-Platform Terminal** — runs commands on Windows, Mac, and Linux
- **Git Tools** — status, log, diff without leaving the chat
- **Code Search** — regex or literal search across the entire project

Works with **VS Code**, **Cursor**, **Claude Desktop**, **Windsurf**, and any MCP-compatible client.

---

## Installation

```bash
npm install -g mcp-devkit
```

Or clone and build:

```bash
git clone https://github.com/BlackWh1te/mcp-devkit.git
cd mcp-devkit
npm install
npm run build
```

---

## Quick Start

### VS Code / Cursor

Add to your MCP settings (`.cursor/mcp.json` or VS Code settings):

```json
{
  "mcpServers": {
    "devkit": {
      "command": "npx",
      "args": ["mcp-devkit"]
    }
  }
}
```

### Claude Desktop

Edit `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "devkit": {
      "command": "npx",
      "args": ["mcp-devkit"]
    }
  }
}
```

Restart your AI client. Done.

---

## Tools

| Tool | Description |
|------|-------------|
| `scan_project` | Deep-scan any directory. Detects languages, frameworks, entry points, test frameworks |
| `get_project_summary` | Human-readable summary of what the project is and how to run it |
| `explain_architecture` | High-level architecture map: entry points, module relationships, data flow |
| `remember` | Store a persistent memory (fact, TODO, decision) with tags |
| `recall` | Search stored memories by keyword |
| `list_memories` | List all stored memories |
| `run_command` | Execute terminal commands. Auto-detects Windows CMD/PowerShell vs Unix bash |
| `git_status` | Git status: modified, staged, untracked |
| `git_log` | Recent commit history |
| `git_diff` | Unstaged changes or diff against a branch/commit |
| `search_code` | Regex or literal search across the whole project |
| `get_file_context` | Read a file, or a specific line range |

---

## Examples

**Ask your AI:**

> "Scan this project and tell me what tech it uses."

> "Remember that we decided to use Zustand for state management."

> "Run `npm test` and show me the output."

> "Search for all TODO comments in the codebase."

> "Show me the git diff."

> "Recall everything about the auth system."

---

## Why This Exists

Most MCP servers are:
- **Single-purpose** — you need 5-10 of them
- **Broken on Windows** — they assume bash and Linux paths
- **Hard to configure** — each needs its own JSON block

MCP DevKit is **one install, one config, works everywhere.**

---

## Supported Tech Stacks (Auto-Detected)

- **JavaScript/TypeScript**: React, Next.js, Vue, Angular, Svelte, Express, NestJS, Remix
- **Python**: Django, Flask, FastAPI
- **Rust**: Cargo
- **Go**: Go Modules
- **Java**: Maven, Gradle
- **.NET**: .csproj / .sln
- **Ruby**: Bundler
- **PHP**: Composer
- **DevOps**: Docker, GitHub Actions, GitLab CI, Azure Pipelines, Jenkins

---

## Tech Stack

- [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- TypeScript
- Node.js 18+
- Zero runtime dependencies besides the MCP SDK

---

## License

MIT
