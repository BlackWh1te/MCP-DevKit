# MCP DevKit

> **One MCP server with 24 tools. Replaces 10+ separate servers.**
>
> Stop installing a dozen MCP servers. This one does it all — and actually works on Windows.

MCP DevKit is a unified [Model Context Protocol](https://modelcontextprotocol.io) server that gives your AI:

- **Project Intelligence** — auto-detects tech stack, frameworks, entry points
- **Persistent Memory** — remembers facts, TODOs, and decisions across sessions
- **Cross-Platform Terminal** — runs commands on Windows, Mac, and Linux
- **File CRUD** — read, write, edit, delete files with safety checks
- **Git Tools** — status, log, diff without leaving the chat
- **Code Search** — regex or literal search across the entire project
- **HTTP Client** — GET/POST/PUT/DELETE requests from the AI
- **Process Manager** — list and kill running processes
- **System Info** — OS, memory, CPU, Node version, environment
- **Port Checker** — see if a port is in use
- **Code Stats** — lines of code, language breakdown, TODO/FIXME counts

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
| `read_file` | Read full contents of any file |
| `write_file` | Write content to a file (creates directories) |
| `edit_file` | Replace a unique string in a file (safety-checked) |
| `delete_file` | Delete a single file safely |
| `list_directory` | Tree-style directory listing with depth control |
| `http_request` | HTTP GET/POST/PUT/DELETE with headers and body |
| `list_processes` | List running processes with PID, name, CPU, memory |
| `kill_process` | Kill a process by PID |
| `get_system_info` | OS, architecture, memory, CPU count, Node version |
| `check_port` | Check if a TCP port is available or in use |
| `get_env_file` | Read .env file with secrets masked |
| `get_code_stats` | Lines of code, language breakdown, TODO/FIXME counts |

---

## Examples

**Ask your AI:**

> "Scan this project and tell me what tech it uses."

> "Remember that we decided to use Zustand for state management."

> "Run `npm test` and show me the output."

> "Search for all TODO comments in the codebase."

> "Show me the git diff."

> "Recall everything about the auth system."

> "Write a README.md with this content."

> "Make an HTTP GET to https://api.github.com/users/BlackWh1te"

> "Is port 3000 in use?"

> "List all running node processes."

> "Show me code statistics for this project."

> "Read the .env file and show me the variables (mask secrets)."

---

## Why This Exists

Most MCP servers are:
- **Single-purpose** — you need 5-10 of them
- **Broken on Windows** — they assume bash and Linux paths
- **Hard to configure** — each needs its own JSON block

MCP DevKit is **one install, one config, 24 tools, works everywhere.**

---

## Supported Tech Stacks (Auto-Detected)

- **JavaScript/TypeScript**: React, Next.js, Vue, Angular, Svelte, SvelteKit, Express, NestJS, Remix, Astro, Gatsby, Nuxt, SolidJS, Preact, Vite, Electron
- **Python**: Django, Flask, FastAPI
- **Rust**: Cargo
- **Go**: Go Modules
- **Java**: Maven, Gradle
- **.NET**: .csproj / .sln
- **Ruby**: Bundler, Ruby on Rails
- **PHP**: Composer, Laravel
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
