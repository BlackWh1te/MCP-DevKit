# MCP DevKit

> **One MCP server with 81 tools. Replaces 25+ separate servers.**
>
> Stop installing a dozen MCP servers. This one does it all — and actually works on Windows.

MCP DevKit is a unified [Model Context Protocol](https://modelcontextprotocol.io) server that gives your AI:

- **Project Intelligence** — auto-detects 60+ tech stacks, frameworks, entry points
- **AI Commit Messages** — analyzes diff and suggests conventional commits
- **Persistent Memory** — remembers facts, TODOs, and decisions across sessions
- **Cross-Platform Terminal** — runs commands on Windows, Mac, and Linux
- **File CRUD** — read, write, edit, delete, move, copy files with safety checks
- **Directory Operations** — create, remove, list directories with tree views
- **Complete Git Suite** — 18 tools: status, log, diff, add, commit, branches, checkout, stash, push, pull, merge, rebase, tags, blame, show, remotes, unstage, restore
- **Code Search** — regex or literal search with extension filtering
- **HTTP Client** — GET/POST/PUT/DELETE requests from the AI
- **Web Fetch** — fetch URLs, strip HTML, extract text, get JSON
- **Process Manager** — list and kill running processes
- **System Info** — OS, memory, CPU, Node version, environment
- **Port Checker** — see if a port is in use
- **Package Scripts** — auto-detect and run npm/yarn/pnpm/bun/make/cargo scripts
- **Code Stats** — lines of code, language breakdown, TODO/FIXME counts
- **Utility Tools** — UUID, hash (md5/sha256), base64, URL encode/decode, JSON format
- **Time & Timezone** — current time, timezone conversion
- **Sequential Thinking** — chain-of-thought reasoning session with persistence
- **JSON Database** — simple key-value store with search
- **File Info & Tree** — metadata and ASCII tree views
- **Dev Utils** — text diff, regex tester, password generator, JWT decoder, text analysis, color converter, math evaluator
- **Todo Manager** — create, list, complete, delete todos

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
| `git_add` | Stage files for commit |
| `git_commit` | Commit with a message |
| `git_branches` | List all branches |
| `git_checkout` | Switch or create branches |
| `git_stash` | Stash current changes |
| `git_stash_pop` | Pop a stash |
| `git_stash_list` | List all stashes |
| `git_unstage` | Remove files from staging area |
| `git_restore` | Discard changes, restore to HEAD |
| `git_push` | Push to remote (with force-with-lease) |
| `git_pull` | Pull from remote |
| `git_remote` | List configured remotes |
| `git_merge` | Merge a branch |
| `git_rebase` | Rebase onto a branch |
| `git_tags` | List all tags |
| `git_create_tag` | Create an annotated tag |
| `git_blame` | Who last modified each line |
| `git_show` | Show commit details and stats |
| `search_code` | Regex or literal search across the whole project. Filter by extension |
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
| `generate_commit_message` | AI-powered commit suggestion from git diff (conventional commits) |
| `generate_uuid` | Generate a random UUID v4 |
| `hash_text` | Hash text with md5, sha1, sha256, sha512 |
| `base64_encode` / `base64_decode` | Base64 encode/decode |
| `url_encode` / `url_decode` | URL encode/decode |
| `format_json` | Pretty-print and validate JSON |
| `get_current_time` | Current time, optionally in an IANA timezone |
| `convert_time` | Convert time between IANA timezones |
| `think` | Add a thought to a chain-of-thought reasoning session |
| `get_thoughts` | Retrieve thinking session, optionally filter |
| `clear_thinking` | Clear the thinking session |
| `db_set` / `db_get` / `db_delete` | Store, retrieve, delete key-value pairs |
| `db_list` | List keys in a JSON database |
| `db_query` | Search database values by content |
| `fetch_text` | Fetch URL, strip HTML, return clean text |
| `fetch_json` | Fetch URL and return parsed JSON |
| `get_file_info` | File/directory metadata: size, dates, permissions |
| `directory_tree` | ASCII tree view of directory structure |
| `move_file` | Move or rename a file or directory |
| `copy_file` | Copy a file or directory |
| `create_directory` | Create a new directory |
| `remove_directory` | Remove a directory (recursively if non-empty) |
| `diff_text` | Compare two text strings and show differences |
| `regex_test` | Test a regular expression against a string |
| `generate_password` | Generate a secure random password |
| `jwt_decode` | Decode a JWT token and show its payload |
| `analyze_text` | Analyze text statistics (word count, character count, sentence count, reading time) |
| `convert_color` | Convert colors between different formats (hex, rgb, hsl) |
| `evaluate_math` | Safely evaluate mathematical expressions |
| `create_todo` | Create a new todo item |
| `list_todos` | List all todos |
| `complete_todo` | Mark a todo as completed |
| `delete_todo` | Delete a todo |
| `get_package_scripts` | Auto-detect scripts from package.json/Makefile/Cargo.toml |
| `run_package_script` | Run a script using detected package manager |

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

> "Generate a commit message for my staged changes."

> "Run the dev script."

> "Search for 'useState' only in .tsx files."

> "Fetch https://example.com and summarize the content."

> "Generate a UUID for this new API key."

> "Show me an ASCII tree of the src directory."

> "Store this config in the 'settings' database under key 'theme'."

> "What time is it in Tokyo right now?"

> "Let's think through this architecture problem step by step."

> "Compare these two code snippets and show me the differences."

> "Test this regex pattern against my text."

> "Generate a secure 32-character password."

> "Decode this JWT token and show me the payload."

> "Analyze the text statistics of this README."

> "Convert this color from hex to HSL."

> "Evaluate this math expression safely."

> "Create a todo: Fix the login bug with high priority."

> "List all my todos."

> "Mark todo #5 as completed."

---

## Why This Exists

Most MCP servers are:
- **Single-purpose** — you need 5-10 of them
- **Broken on Windows** — they assume bash and Linux paths
- **Hard to configure** — each needs its own JSON block

MCP DevKit is **one install, one config, 81 tools, works everywhere.**

---

## Supported Tech Stacks (Auto-Detected)

- **JavaScript/TypeScript**: React, Next.js, Vue, Angular, Svelte, SvelteKit, Express, NestJS, Remix, Astro, Gatsby, Nuxt, SolidJS, Preact, Vite, Electron, Tauri, Capacitor, Ionic
- **State Management**: Redux, Zustand, Pinia, Jotai
- **ORM/DB**: Prisma, Drizzle ORM, TypeORM, Sequelize, Mongoose, MongoDB, Supabase, Firebase
- **API**: GraphQL, tRPC, Socket.IO, WebSocket
- **Python**: Django, Flask, FastAPI
- **Rust**: Cargo, Axum, Actix, Rocket, Bevy
- **Go**: Go Modules, Fiber, Gin, Echo, Chi
- **Java**: Maven, Gradle
- **.NET**: .csproj / .sln
- **Ruby**: Bundler, Ruby on Rails
- **PHP**: Composer, Laravel
- **Mobile**: Flutter, Dart, Kotlin, Swift
- **Game Dev**: Unity, Unreal Engine, Godot
- **DevOps**: Docker, GitHub Actions, GitLab CI, Azure Pipelines, Jenkins, Terraform, Kubernetes, Ansible, Pulumi
- **Platforms**: Vercel, Netlify, Cloudflare Workers

---

## Tech Stack

- [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- TypeScript
- Node.js 18+
- Zero runtime dependencies besides the MCP SDK

---

## License

MIT
