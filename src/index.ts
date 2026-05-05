#!/usr/bin/env node
// BlackWhite — MCP DevKit
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, TextContent } from "@modelcontextprotocol/sdk/types.js";

import { scanProject, getProjectSummary, explainArchitecture } from "./scanner.js";
import {
  remember,
  recall,
  listMemories,
  deduplicateMemories,
  summarizeMemory,
  findRelatedMemories,
  exportMemories,
  importMemories,
  getMemoryHealth,
  pruneMemories,
  consolidateMemories,
  forgetMemory,
  updateMemoryImportance,
  searchBySentiment,
} from "./memory.js";
import { runCommand } from "./terminal.js";
import {
  gitStatus,
  gitLog,
  gitDiff,
  gitAdd,
  gitCommit,
  gitBranches,
  gitCheckout,
  gitStash,
  gitStashPop,
  gitStashList,
  gitUnstage,
  gitRestore,
  gitPush,
  gitPull,
  gitRemote,
  gitMerge,
  gitRebase,
  gitTags,
  gitCreateTag,
  gitBlame,
  gitShow,
  analyzeBranchHealth,
  analyzeWorkflow,
  scoreCommitQuality,
  detectConflicts,
  getGitConfig,
  analyzeCommitImpact,
  getAuthorStats,
  analyzeBranchEvolution,
  getRepoInsights,
} from "./git-tools.js";
import { searchCode, getFileContext } from "./search.js";
import {
  readFile,
  writeFile,
  editFile,
  deleteFile,
  moveFile,
  copyFile,
  createDirectory,
  removeDirectory,
  listDirectory,
  diffFiles,
} from "./files.js";
import {
  httpRequest,
  clearHttpCache,
  getHttpCacheStats,
  getHttpPerformance,
  resetCircuitBreaker,
  clearHttpMetrics,
} from "./http.js";
import {
  listProcesses,
  killProcess,
  getProcessTree,
  monitorProcess,
  filterProcesses,
  clearProcessHistory,
  getProcessHistory,
} from "./process.js";
import { getSystemInfo, checkPort, getEnvFile, getDiskUsage, getNetworkInfo, getEnvVarAnalysis } from "./system.js";
import { getCodeStats } from "./stats.js";
import { generateCommitMessage, validateCommit } from "./ai-commit.js";
import {
  getPackageScripts,
  runPackageScript,
  getDependencies,
  clearPackageCache,
  getPackageCacheStats,
  getPackageInfo,
} from "./package-runner.js";
import {
  generateUUID,
  hashText,
  base64Encode,
  base64Decode,
  urlEncode,
  urlDecode,
  formatJson,
  getCurrentTime,
  convertTime,
} from "./utils.js";
import { think, getThoughts, clearThinking } from "./thinking.js";
import { dbSet, dbGet, dbDelete, dbList, dbQuery, dbBatchSet, dbBatchGet, dbClearStore } from "./database.js";
import {
  fetchText,
  fetchJson,
  getFileInfo,
  directoryTree,
  fetchStructured,
  extractLinks,
  extractForms,
} from "./web.js";
import {
  diffText,
  regexTest,
  generatePassword,
  jwtDecode,
  analyzeText,
  convertColor,
  evaluateMath,
  csvParse,
  csvFormat,
  markdownTable,
} from "./dev-utils.js";
import { createTodo, listTodos, completeTodo, deleteTodo } from "./todos.js";
import {
  saveSnippet,
  findSnippet,
  getSnippet,
  listSnippets,
  deleteSnippet,
  updateSnippet,
  exportSnippets,
  importSnippets,
} from "./snippets.js";
import {
  listTemplates,
  getTemplate,
  renderTemplateFile,
  createTemplate,
  deleteTemplate,
  searchTemplates,
} from "./templates.js";
import { batchRead, batchWrite, batchEdit, batchDelete, batchCopy, batchMove } from "./batch-files.js";
import { createArchive, extractArchive, getArchiveInfo, gzipFile, gunzipFile } from "./archive.js";
import {
  getConfig,
  setConfig,
  resetConfig,
  listConfigSections,
  deleteConfigKey,
  exportConfig,
  importConfig,
} from "./config.js";

const server = new Server(
  {
    name: "mcp-devkit",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "scan_project",
        description:
          "Deep-scan a directory to detect project structure, tech stack, frameworks, and key files. Returns structured JSON with languages, entry points, dependencies, and architecture hints. Works on any OS.",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Absolute or relative path to the project directory",
            },
            depth: {
              type: "number",
              description: "Max directory depth to scan (default: 5)",
              default: 5,
            },
          },
          required: ["path"],
        },
      },
      {
        name: "get_project_summary",
        description:
          "Get a concise, human-readable summary of the scanned project: what it is, what tech it uses, how to run it.",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Path to the project directory",
            },
          },
          required: ["path"],
        },
      },
      {
        name: "explain_architecture",
        description:
          "Analyze the project and return a high-level architecture description: entry points, module relationships, data flow.",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Path to the project directory",
            },
          },
          required: ["path"],
        },
      },
      {
        name: "remember",
        description:
          "Store a persistent memory item (fact, TODO, decision, context) that the AI can recall later, even across sessions.",
        inputSchema: {
          type: "object",
          properties: {
            key: {
              type: "string",
              description: "Short unique key or topic (e.g., 'auth-decision', 'todo-api')",
            },
            content: {
              type: "string",
              description: "The full text to remember",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Optional tags for filtering",
              default: [],
            },
          },
          required: ["key", "content"],
        },
      },
      {
        name: "recall",
        description: "Search stored memories by keyword. Returns the most relevant matches.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Keyword or phrase to search for",
            },
            limit: {
              type: "number",
              description: "Max results (default: 10)",
              default: 10,
            },
          },
          required: ["query"],
        },
      },
      {
        name: "list_memories",
        description:
          "List all stored memory keys, tags, categories, sentiment, and freshness. Filter by tag or category.",
        inputSchema: {
          type: "object",
          properties: {
            tag: {
              type: "string",
              description: "Optional tag filter",
            },
            category: {
              type: "string",
              description: "Optional category filter (e.g., api, frontend, security, debugging)",
            },
          },
        },
      },
      {
        name: "deduplicate_memories",
        description: "Find and report duplicate or similar memories using similarity analysis.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "summarize_memory",
        description: "Generate or retrieve a summary for a specific memory.",
        inputSchema: {
          type: "object",
          properties: {
            key: {
              type: "string",
              description: "Memory key to summarize",
            },
          },
          required: ["key"],
        },
      },
      {
        name: "find_related_memories",
        description: "Find memories related to a specific memory based on content and tags.",
        inputSchema: {
          type: "object",
          properties: {
            key: {
              type: "string",
              description: "Memory key to find relations for",
            },
            threshold: {
              type: "number",
              description: "Similarity threshold (default: 0.3)",
              default: 0.3,
            },
          },
          required: ["key"],
        },
      },
      {
        name: "export_memories",
        description: "Export all memories to a backup JSON file.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "import_memories",
        description: "Import memories from a backup JSON file. Merges duplicates instead of skipping.",
        inputSchema: {
          type: "object",
          properties: {
            backupPath: {
              type: "string",
              description: "Path to backup JSON file",
            },
          },
          required: ["backupPath"],
        },
      },
      {
        name: "get_memory_health",
        description:
          "Get a comprehensive health report of the memory system: total count, active vs stale, sentiment distribution, top categories, growth, and unused memories.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "prune_memories",
        description:
          "Remove low-value memories based on importance, access count, and decay. Keeps the most valuable memories. Optional keepCount to override default 80% retention.",
        inputSchema: {
          type: "object",
          properties: {
            keepCount: {
              type: "number",
              description: "Optional number of memories to keep",
            },
          },
        },
      },
      {
        name: "consolidate_memories",
        description:
          "Auto-merge highly similar (>90%) duplicate memories into single entries. Updates tags and importance.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "forget_memory",
        description: "Permanently delete a memory by key.",
        inputSchema: {
          type: "object",
          properties: {
            key: {
              type: "string",
              description: "Memory key to delete",
            },
          },
          required: ["key"],
        },
      },
      {
        name: "update_memory_importance",
        description: "Manually set the importance score (0-10) of a memory.",
        inputSchema: {
          type: "object",
          properties: {
            key: {
              type: "string",
              description: "Memory key",
            },
            importance: {
              type: "number",
              description: "Importance score 0-10",
            },
          },
          required: ["key", "importance"],
        },
      },
      {
        name: "search_by_sentiment",
        description: "Search memories filtered by sentiment: positive, neutral, or negative.",
        inputSchema: {
          type: "object",
          properties: {
            sentiment: {
              type: "string",
              description: "Sentiment to filter by: positive, neutral, negative",
            },
          },
          required: ["sentiment"],
        },
      },
      {
        name: "run_command",
        description:
          "Execute a terminal command safely. Auto-detects Windows (CMD/PowerShell) vs Unix (bash/sh). Returns stdout, stderr, and exit code. Use with care.",
        inputSchema: {
          type: "object",
          properties: {
            command: {
              type: "string",
              description: "The command to run",
            },
            cwd: {
              type: "string",
              description: "Working directory (default: current)",
            },
            shell: {
              type: "string",
              description: "Override shell: 'cmd', 'powershell', 'bash', 'sh'",
            },
            timeout: {
              type: "number",
              description: "Timeout in ms (default: 30000)",
              default: 30000,
            },
          },
          required: ["command"],
        },
      },
      {
        name: "git_status",
        description: "Get git status of a repository: modified, staged, untracked files.",
        inputSchema: {
          type: "object",
          properties: {
            repoPath: {
              type: "string",
              description: "Path to git repository (default: current)",
            },
          },
        },
      },
      {
        name: "git_log",
        description: "Get recent git commit history.",
        inputSchema: {
          type: "object",
          properties: {
            repoPath: {
              type: "string",
              description: "Path to git repository (default: current)",
            },
            count: {
              type: "number",
              description: "Number of commits (default: 10)",
              default: 10,
            },
          },
        },
      },
      {
        name: "git_diff",
        description: "Get git diff: unstaged changes, or between branches/commits.",
        inputSchema: {
          type: "object",
          properties: {
            repoPath: {
              type: "string",
              description: "Path to git repository (default: current)",
            },
            target: {
              type: "string",
              description: "Branch, commit, or 'HEAD' for unstaged (default: unstaged)",
            },
          },
        },
      },
      {
        name: "search_code",
        description:
          "AI-powered code search. Detects match types (definition, usage, import, comment, string), extracts symbol names, and scores relevance by context. Respects .gitignore.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Regex pattern or literal string",
            },
            path: {
              type: "string",
              description: "Directory to search (default: current)",
            },
            literal: {
              type: "boolean",
              description: "If true, treat query as literal string (default: false)",
              default: false,
            },
            maxResults: {
              type: "number",
              description: "Max matches (default: 50)",
              default: 50,
            },
            ext: {
              type: "string",
              description: "Filter by file extension, e.g., '.ts' or '.py'",
            },
            caseSensitive: {
              type: "boolean",
              description: "Case-sensitive search (default: false)",
              default: false,
            },
            contextLines: {
              type: "number",
              description: "Context lines before/after match (default: 2)",
              default: 2,
            },
          },
          required: ["query"],
        },
      },
      {
        name: "get_file_context",
        description: "Read a file with smart chunking. Returns the file content, or a specific range/lines.",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Absolute or relative path to the file",
            },
            startLine: {
              type: "number",
              description: "Start line (1-based, default: 1)",
              default: 1,
            },
            endLine: {
              type: "number",
              description: "End line (inclusive, default: file end)",
            },
          },
          required: ["filePath"],
        },
      },
      {
        name: "read_file",
        description: "Read the full contents of a file as text.",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Path to the file",
            },
          },
          required: ["filePath"],
        },
      },
      {
        name: "write_file",
        description: "Write text content to a file. Creates directories if needed. Overwrites existing files.",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Path to the file",
            },
            content: {
              type: "string",
              description: "Content to write",
            },
          },
          required: ["filePath", "content"],
        },
      },
      {
        name: "edit_file",
        description:
          "Replace a unique string in a file. Returns an error if the string is not found or appears more than once.",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Path to the file",
            },
            oldString: {
              type: "string",
              description: "Exact string to replace (must be unique in file)",
            },
            newString: {
              type: "string",
              description: "Replacement string",
            },
          },
          required: ["filePath", "oldString", "newString"],
        },
      },
      {
        name: "delete_file",
        description: "Delete a single file safely. Refuses to delete directories.",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Path to the file to delete",
            },
          },
          required: ["filePath"],
        },
      },
      {
        name: "list_directory",
        description: "List files and directories with a nice tree view, respecting max depth.",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Directory path (default: current)",
              default: ".",
            },
            depth: {
              type: "number",
              description: "Max depth (default: 1)",
              default: 1,
            },
          },
        },
      },
      {
        name: "http_request",
        description:
          "Make HTTP GET/POST/PUT/DELETE requests with circuit breaker, retry logic with exponential backoff, response caching, and performance tracking. Returns status, headers, body, latency, validation warnings, and attempt count.",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "URL to request",
            },
            method: {
              type: "string",
              description: "HTTP method (default: GET)",
              default: "GET",
            },
            headers: {
              type: "object",
              description: "Optional headers as key-value pairs",
            },
            body: {
              type: "string",
              description: "Request body (for POST/PUT/PATCH)",
            },
            timeout: {
              type: "number",
              description: "Timeout in ms (default: 30000)",
              default: 30000,
            },
            retryCount: {
              type: "number",
              description: "Number of retry attempts on failure (default: 3)",
              default: 3,
            },
            retryDelay: {
              type: "number",
              description: "Initial retry delay in ms with exponential backoff (default: 1000)",
              default: 1000,
            },
            cache: {
              type: "boolean",
              description: "Enable response caching for GET requests (default: false)",
              default: false,
            },
            cacheTTL: {
              type: "number",
              description: "Cache time-to-live in ms (default: 60000)",
              default: 60000,
            },
            expectJson: {
              type: "boolean",
              description: "Validate response is JSON (default: false)",
              default: false,
            },
            validateStatus: {
              type: "number",
              description: "Expected HTTP status code (optional validation)",
            },
          },
          required: ["url"],
        },
      },
      {
        name: "clear_http_cache",
        description: "Clear the HTTP response cache.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_http_cache_stats",
        description: "Get statistics about the HTTP response cache: size and cached entries.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_http_performance",
        description:
          "Get HTTP performance metrics: total requests, success rate, avg/P95/P99 latency, and per-domain stats including circuit breaker status.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "reset_circuit_breaker",
        description:
          "Reset the circuit breaker for a specific domain or all domains. Allows retrying requests to previously failed domains.",
        inputSchema: {
          type: "object",
          properties: {
            domain: {
              type: "string",
              description: "Optional domain to reset (default: all domains)",
            },
          },
        },
      },
      {
        name: "clear_http_metrics",
        description: "Clear all HTTP performance metrics and circuit breaker states. Resets tracking to initial state.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "list_processes",
        description:
          "List running processes (cross-platform: Windows tasklist, Unix ps). Returns PID, name, user, CPU, memory, and start time. Maintains monitoring history.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "kill_process",
        description:
          "Kill a process by PID. Cross-platform (taskkill on Windows, kill on Unix). Removes from monitoring history.",
        inputSchema: {
          type: "object",
          properties: {
            pid: {
              type: "string",
              description: "Process ID to kill",
            },
          },
          required: ["pid"],
        },
      },
      {
        name: "get_process_tree",
        description:
          "Get a hierarchical tree view of processes showing parent-child relationships. Optionally filter by specific PID.",
        inputSchema: {
          type: "object",
          properties: {
            pid: {
              type: "string",
              description: "Optional process ID to get tree for (default: all processes)",
            },
          },
        },
      },
      {
        name: "monitor_process",
        description:
          "Monitor a specific process over time, sampling CPU and memory usage at regular intervals. Returns statistics including averages and maximums.",
        inputSchema: {
          type: "object",
          properties: {
            pid: {
              type: "string",
              description: "Process ID to monitor",
            },
            duration: {
              type: "number",
              description: "Monitoring duration in milliseconds (default: 60000)",
              default: 60000,
            },
          },
          required: ["pid"],
        },
      },
      {
        name: "filter_processes",
        description: "Filter processes by name, user, minimum CPU, or minimum memory usage.",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Filter by process name (partial match)",
            },
            user: {
              type: "string",
              description: "Filter by user name (partial match)",
            },
            minCpu: {
              type: "number",
              description: "Minimum CPU percentage",
            },
            minMem: {
              type: "number",
              description: "Minimum memory percentage",
            },
          },
        },
      },
      {
        name: "get_process_history",
        description: "Get monitoring history for processes. Optionally filter by specific PID.",
        inputSchema: {
          type: "object",
          properties: {
            pid: {
              type: "string",
              description: "Optional process ID to get history for (default: all processes)",
            },
          },
        },
      },
      {
        name: "clear_process_history",
        description: "Clear all process monitoring history.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_system_info",
        description:
          "Get system information: OS, architecture, memory, CPU count, Node version, environment variables.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "check_port",
        description: "Check if a TCP port is available or in use on a host.",
        inputSchema: {
          type: "object",
          properties: {
            port: {
              type: "number",
              description: "Port number to check",
            },
            host: {
              type: "string",
              description: "Host to check (default: 127.0.0.1)",
              default: "127.0.0.1",
            },
          },
          required: ["port"],
        },
      },
      {
        name: "get_env_file",
        description:
          "Read a .env file and return variable names with values (secrets masked). Detects and lists secret keys.",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Path to env file (default: .env)",
              default: ".env",
            },
          },
        },
      },
      {
        name: "get_disk_usage",
        description:
          "Get disk usage information for the system or specific directory. Cross-platform (Windows wmic, Unix df).",
        inputSchema: {
          type: "object",
          properties: {
            dirPath: {
              type: "string",
              description: "Directory path to check (default: current directory)",
            },
          },
        },
      },
      {
        name: "get_network_info",
        description:
          "Get detailed network interface information including IP addresses, MAC addresses, and CIDR notation.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_env_var_analysis",
        description:
          "Analyze environment variables by category (PATH, HOME, SHELL, cloud providers) and detect sensitive variables.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_code_stats",
        description:
          "AI-enhanced code analysis: lines of code, language breakdown, TODO/FIXME counts, file sizes, complexity scoring, import analysis, comment coverage, hotspot detection, and architecture metrics (modularity, cohesion, coupling). Cross-platform.",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Project path (default: current)",
              default: ".",
            },
          },
        },
      },
      {
        name: "generate_commit_message",
        description:
          "AI-powered commit message generator. Analyzes staged (or unstaged) git diff and suggests a conventional commit message with type, scope, breaking change detection, issues/refs extraction, and footer generation.",
        inputSchema: {
          type: "object",
          properties: {
            repoPath: {
              type: "string",
              description: "Path to git repository (default: current)",
            },
          },
        },
      },
      {
        name: "validate_commit",
        description:
          "Validate a commit message against conventional commits specification. Checks format, type, description length, and imperative mood.",
        inputSchema: {
          type: "object",
          properties: {
            repoPath: {
              type: "string",
              description: "Path to git repository (validates last commit if no message provided)",
            },
            commitMessage: {
              type: "string",
              description: "Commit message to validate (optional, validates last commit if not provided)",
            },
          },
        },
      },
      {
        name: "git_add",
        description: "Stage files for commit.",
        inputSchema: {
          type: "object",
          properties: {
            files: {
              type: "array",
              items: { type: "string" },
              description: "File paths to stage (use ['.'] for all)",
            },
            repoPath: {
              type: "string",
              description: "Path to git repository (default: current)",
            },
          },
          required: ["files"],
        },
      },
      {
        name: "git_commit",
        description: "Commit staged changes with a message.",
        inputSchema: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "Commit message",
            },
            repoPath: {
              type: "string",
              description: "Path to git repository (default: current)",
            },
          },
          required: ["message"],
        },
      },
      {
        name: "git_branches",
        description: "List all git branches with current branch marker.",
        inputSchema: {
          type: "object",
          properties: {
            repoPath: {
              type: "string",
              description: "Path to git repository (default: current)",
            },
          },
        },
      },
      {
        name: "git_checkout",
        description: "Switch to an existing branch or create a new one.",
        inputSchema: {
          type: "object",
          properties: {
            branch: {
              type: "string",
              description: "Branch name",
            },
            create: {
              type: "boolean",
              description: "Create the branch if it doesn't exist",
              default: false,
            },
            repoPath: {
              type: "string",
              description: "Path to git repository (default: current)",
            },
          },
          required: ["branch"],
        },
      },
      {
        name: "git_stash",
        description: "Stash current changes. Optionally provide a message.",
        inputSchema: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "Optional stash message",
            },
            repoPath: {
              type: "string",
              description: "Path to git repository (default: current)",
            },
          },
        },
      },
      {
        name: "git_stash_pop",
        description: "Pop a stash from the stash list. Default pops the most recent (index 0).",
        inputSchema: {
          type: "object",
          properties: {
            index: {
              type: "number",
              description: "Stash index (default: 0)",
              default: 0,
            },
            repoPath: {
              type: "string",
              description: "Path to git repository (default: current)",
            },
          },
        },
      },
      {
        name: "git_stash_list",
        description: "List all stashes.",
        inputSchema: {
          type: "object",
          properties: {
            repoPath: {
              type: "string",
              description: "Path to git repository (default: current)",
            },
          },
        },
      },
      {
        name: "git_unstage",
        description: "Unstage files (remove from staging area but keep changes).",
        inputSchema: {
          type: "object",
          properties: {
            files: {
              type: "array",
              items: { type: "string" },
              description: "Files to unstage (use ['.'] for all)",
            },
            repoPath: {
              type: "string",
              description: "Path to git repository (default: current)",
            },
          },
          required: ["files"],
        },
      },
      {
        name: "git_restore",
        description: "Restore files to their last committed state (discards changes).",
        inputSchema: {
          type: "object",
          properties: {
            files: {
              type: "array",
              items: { type: "string" },
              description: "Files to restore (use ['.'] for all)",
            },
            repoPath: {
              type: "string",
              description: "Path to git repository (default: current)",
            },
          },
          required: ["files"],
        },
      },
      {
        name: "git_push",
        description: "Push commits to a remote repository. Supports force-with-lease for safe force push.",
        inputSchema: {
          type: "object",
          properties: {
            remote: {
              type: "string",
              description: "Remote name (default: origin)",
            },
            branch: {
              type: "string",
              description: "Branch name",
            },
            force: {
              type: "boolean",
              description: "Use --force-with-lease (safer than bare force)",
              default: false,
            },
            repoPath: {
              type: "string",
              description: "Path to git repository (default: current)",
            },
          },
        },
      },
      {
        name: "git_pull",
        description: "Pull changes from a remote repository.",
        inputSchema: {
          type: "object",
          properties: {
            remote: {
              type: "string",
              description: "Remote name (default: origin)",
            },
            branch: {
              type: "string",
              description: "Branch name",
            },
            repoPath: {
              type: "string",
              description: "Path to git repository (default: current)",
            },
          },
        },
      },
      {
        name: "git_remote",
        description: "List configured remotes with their fetch/push URLs.",
        inputSchema: {
          type: "object",
          properties: {
            repoPath: {
              type: "string",
              description: "Path to git repository (default: current)",
            },
          },
        },
      },
      {
        name: "git_merge",
        description: "Merge a branch into the current branch.",
        inputSchema: {
          type: "object",
          properties: {
            branch: {
              type: "string",
              description: "Branch to merge",
            },
            noFastForward: {
              type: "boolean",
              description: "Create a merge commit even if fast-forward is possible",
              default: false,
            },
            repoPath: {
              type: "string",
              description: "Path to git repository (default: current)",
            },
          },
          required: ["branch"],
        },
      },
      {
        name: "git_rebase",
        description: "Rebase current branch onto another branch.",
        inputSchema: {
          type: "object",
          properties: {
            branch: {
              type: "string",
              description: "Branch to rebase onto",
            },
            repoPath: {
              type: "string",
              description: "Path to git repository (default: current)",
            },
          },
          required: ["branch"],
        },
      },
      {
        name: "git_tags",
        description: "List all tags.",
        inputSchema: {
          type: "object",
          properties: {
            repoPath: {
              type: "string",
              description: "Path to git repository (default: current)",
            },
          },
        },
      },
      {
        name: "git_create_tag",
        description: "Create a new tag. Optionally annotate with a message.",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Tag name (e.g., v1.0.0)",
            },
            message: {
              type: "string",
              description: "Optional annotated tag message",
            },
            repoPath: {
              type: "string",
              description: "Path to git repository (default: current)",
            },
          },
          required: ["name"],
        },
      },
      {
        name: "git_blame",
        description: "Show who last modified each line of a file (git blame).",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Path to the file",
            },
            startLine: {
              type: "number",
              description: "Start line (1-based, optional)",
            },
            endLine: {
              type: "number",
              description: "End line (inclusive, optional)",
            },
            repoPath: {
              type: "string",
              description: "Path to git repository (default: current)",
            },
          },
          required: ["filePath"],
        },
      },
      {
        name: "git_show",
        description: "Show details of a commit: stats, changed files, message.",
        inputSchema: {
          type: "object",
          properties: {
            commit: {
              type: "string",
              description: "Commit hash or ref (e.g., HEAD, abc1234)",
            },
            repoPath: {
              type: "string",
              description: "Path to git repository (default: current)",
            },
          },
          required: ["commit"],
        },
      },
      {
        name: "analyze_branch_health",
        description: "Analyze branch health: stale branches, uncommitted changes, ahead/behind status.",
        inputSchema: {
          type: "object",
          properties: {
            repoPath: {
              type: "string",
              description: "Path to git repository (default: current)",
            },
          },
        },
      },
      {
        name: "analyze_workflow",
        description: "Detect git workflow type (GitFlow, Trunk-Based, Feature Branch) and provide recommendations.",
        inputSchema: {
          type: "object",
          properties: {
            repoPath: {
              type: "string",
              description: "Path to git repository (default: current)",
            },
          },
        },
      },
      {
        name: "score_commit_quality",
        description: "Score commit message quality based on conventional commits, length, and style.",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Number of recent commits to analyze (default: 10)",
              default: 10,
            },
            repoPath: {
              type: "string",
              description: "Path to git repository (default: current)",
            },
          },
        },
      },
      {
        name: "detect_conflicts",
        description: "Detect merge conflicts and provide resolution suggestions.",
        inputSchema: {
          type: "object",
          properties: {
            repoPath: {
              type: "string",
              description: "Path to git repository (default: current)",
            },
          },
        },
      },
      {
        name: "get_git_config",
        description: "Get local and global git configuration.",
        inputSchema: {
          type: "object",
          properties: {
            repoPath: {
              type: "string",
              description: "Path to git repository (default: current)",
            },
          },
        },
      },
      {
        name: "analyze_commit_impact",
        description:
          "Analyze commit impact: blast radius (insertions + deletions), files changed, and affected files. Helps identify high-impact commits.",
        inputSchema: {
          type: "object",
          properties: {
            repoPath: {
              type: "string",
              description: "Path to git repository (default: current)",
            },
            limit: {
              type: "number",
              description: "Number of commits to analyze (default: 10)",
              default: 10,
            },
          },
        },
      },
      {
        name: "get_author_stats",
        description:
          "Get author contribution statistics: commits, lines added/deleted, net contribution, first/last commit, and average commit size per author.",
        inputSchema: {
          type: "object",
          properties: {
            repoPath: {
              type: "string",
              description: "Path to git repository (default: current)",
            },
            limit: {
              type: "number",
              description: "Number of top authors to return (default: 20)",
              default: 20,
            },
          },
        },
      },
      {
        name: "analyze_branch_evolution",
        description:
          "Analyze branch evolution: commit velocity, trends (increasing/stable/decreasing), contributor count, and time span. Track branch health over time.",
        inputSchema: {
          type: "object",
          properties: {
            repoPath: {
              type: "string",
              description: "Path to git repository (default: current)",
            },
            branch: {
              type: "string",
              description: "Branch to analyze (default: current branch)",
            },
          },
        },
      },
      {
        name: "get_repo_insights",
        description:
          "Get comprehensive repository insights: commit impact, top authors, branch health, and workflow detection in one call.",
        inputSchema: {
          type: "object",
          properties: {
            repoPath: {
              type: "string",
              description: "Path to git repository (default: current)",
            },
          },
        },
      },
      {
        name: "get_package_scripts",
        description:
          "Detect and list available package scripts from package.json, pyproject.toml, Makefile, or Cargo.toml.",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Project path (default: current)",
              default: ".",
            },
          },
        },
      },
      {
        name: "run_package_script",
        description: "Run a package script using the detected package manager (npm/yarn/pnpm/bun/make/cargo).",
        inputSchema: {
          type: "object",
          properties: {
            script: {
              type: "string",
              description: "Script name to run (e.g., 'test', 'build', 'dev')",
            },
            path: {
              type: "string",
              description: "Project path (default: current)",
              default: ".",
            },
          },
          required: ["script"],
        },
      },
      {
        name: "get_dependencies",
        description:
          "Get project dependencies with caching. Supports Node.js (package.json), Python (pyproject.toml), and Rust (Cargo.toml).",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Project path (default: current)",
              default: ".",
            },
          },
        },
      },
      {
        name: "get_package_info",
        description: "Get project package info: name, version, description, author, license, repository, homepage.",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Project path (default: current)",
              default: ".",
            },
          },
        },
      },
      {
        name: "clear_package_cache",
        description: "Clear the package scripts and dependencies cache.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_package_cache_stats",
        description: "Get package cache statistics: script cache size, dependency cache size.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "generate_uuid",
        description: "Generate a random UUID v4.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "hash_text",
        description: "Hash text using md5, sha1, sha256, or sha512.",
        inputSchema: {
          type: "object",
          properties: {
            text: { type: "string", description: "Text to hash" },
            algorithm: { type: "string", description: "Hash algorithm (default: sha256)", default: "sha256" },
          },
          required: ["text"],
        },
      },
      {
        name: "base64_encode",
        description: "Base64-encode text.",
        inputSchema: {
          type: "object",
          properties: { text: { type: "string", description: "Text to encode" } },
          required: ["text"],
        },
      },
      {
        name: "base64_decode",
        description: "Base64-decode text.",
        inputSchema: {
          type: "object",
          properties: { text: { type: "string", description: "Base64 string to decode" } },
          required: ["text"],
        },
      },
      {
        name: "url_encode",
        description: "URL-encode a string.",
        inputSchema: {
          type: "object",
          properties: { text: { type: "string", description: "Text to encode" } },
          required: ["text"],
        },
      },
      {
        name: "url_decode",
        description: "URL-decode a string.",
        inputSchema: {
          type: "object",
          properties: { text: { type: "string", description: "URL-encoded text to decode" } },
          required: ["text"],
        },
      },
      {
        name: "format_json",
        description: "Pretty-print and validate JSON.",
        inputSchema: {
          type: "object",
          properties: { text: { type: "string", description: "JSON string to format" } },
          required: ["text"],
        },
      },
      {
        name: "get_current_time",
        description: "Get current time. Optionally specify an IANA timezone (e.g., America/New_York).",
        inputSchema: {
          type: "object",
          properties: { timezone: { type: "string", description: "IANA timezone name (optional)" } },
        },
      },
      {
        name: "convert_time",
        description: "Convert a time between IANA timezones.",
        inputSchema: {
          type: "object",
          properties: {
            time: { type: "string", description: "Time in 24h format (HH:MM)" },
            sourceTimezone: { type: "string", description: "Source IANA timezone" },
            targetTimezone: { type: "string", description: "Target IANA timezone" },
          },
          required: ["time", "sourceTimezone", "targetTimezone"],
        },
      },
      {
        name: "think",
        description:
          "AI-powered sequential thinking with hypothesis extraction, evidence detection, confidence scoring, and automatic contradiction/support detection across the thought chain.",
        inputSchema: {
          type: "object",
          properties: {
            thought: { type: "string", description: "Your thought text" },
            thoughtNumber: { type: "number", description: "Which thought number this is (1, 2, 3...)" },
            totalThoughts: { type: "number", description: "Estimated total thoughts in chain" },
            nextThoughtNeeded: { type: "boolean", description: "Whether another thought is needed", default: true },
            isRevision: { type: "boolean", description: "Is this a revision of a previous thought?", default: false },
            revisesThought: { type: "number", description: "If revision, which thought number it revises" },
            branchFromThought: { type: "number", description: "If branching, which thought to branch from" },
            branchId: { type: "string", description: "Branch identifier" },
          },
          required: ["thought", "thoughtNumber", "totalThoughts"],
        },
      },
      {
        name: "get_thoughts",
        description: "Retrieve the current thinking session. Optionally filter by keyword or branch.",
        inputSchema: {
          type: "object",
          properties: { filter: { type: "string", description: "Optional keyword or branch ID to filter" } },
        },
      },
      {
        name: "clear_thinking",
        description: "Clear the current thinking session.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "db_set",
        description: "Store a key-value pair in a named JSON database.",
        inputSchema: {
          type: "object",
          properties: {
            store: { type: "string", description: "Database/store name" },
            key: { type: "string", description: "Key" },
            value: { type: "string", description: "Value (JSON or plain text)" },
          },
          required: ["store", "key", "value"],
        },
      },
      {
        name: "db_get",
        description: "Retrieve a value from a named JSON database.",
        inputSchema: {
          type: "object",
          properties: {
            store: { type: "string", description: "Database/store name" },
            key: { type: "string", description: "Key" },
          },
          required: ["store", "key"],
        },
      },
      {
        name: "db_delete",
        description: "Delete a key from a named JSON database.",
        inputSchema: {
          type: "object",
          properties: {
            store: { type: "string", description: "Database/store name" },
            key: { type: "string", description: "Key" },
          },
          required: ["store", "key"],
        },
      },
      {
        name: "db_list",
        description: "List keys in a named JSON database.",
        inputSchema: {
          type: "object",
          properties: {
            store: { type: "string", description: "Database/store name" },
            prefix: { type: "string", description: "Optional prefix filter" },
          },
          required: ["store"],
        },
      },
      {
        name: "db_query",
        description: "Search values in a named JSON database by content.",
        inputSchema: {
          type: "object",
          properties: {
            store: { type: "string", description: "Database/store name" },
            query: { type: "string", description: "Search query" },
          },
          required: ["store", "query"],
        },
      },
      {
        name: "db_batch_set",
        description: "Batch set multiple key-value pairs in a named JSON database.",
        inputSchema: {
          type: "object",
          properties: {
            store: { type: "string", description: "Database/store name" },
            entries: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  key: { type: "string", description: "Key" },
                  value: { type: "string", description: "Value (JSON or plain text)" },
                },
                required: ["key", "value"],
              },
              description: "Array of {key, value} objects",
            },
          },
          required: ["store", "entries"],
        },
      },
      {
        name: "db_batch_get",
        description: "Batch get multiple keys from a named JSON database.",
        inputSchema: {
          type: "object",
          properties: {
            store: { type: "string", description: "Database/store name" },
            keys: {
              type: "array",
              items: { type: "string" },
              description: "Array of keys to retrieve",
            },
          },
          required: ["store", "keys"],
        },
      },
      {
        name: "db_clear_store",
        description: "Clear all keys in a named JSON database.",
        inputSchema: {
          type: "object",
          properties: {
            store: { type: "string", description: "Database/store name" },
          },
          required: ["store"],
        },
      },
      {
        name: "fetch_text",
        description: "Fetch a URL and return text content. Strips HTML tags. Supports JSON.",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string", description: "URL to fetch" },
            timeout: { type: "number", description: "Timeout in ms (default: 30000)", default: 30000 },
          },
          required: ["url"],
        },
      },
      {
        name: "fetch_json",
        description: "Fetch a URL and return parsed JSON.",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string", description: "URL to fetch" },
            timeout: { type: "number", description: "Timeout in ms (default: 30000)", default: 30000 },
          },
          required: ["url"],
        },
      },
      {
        name: "fetch_structured",
        description:
          "Fetch a URL and return structured data extraction: title, description, metadata, links, forms, headings. Supports CSS selector matching.",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string", description: "URL to fetch" },
            timeout: { type: "number", description: "Timeout in ms (default: 30000)", default: 30000 },
            followRedirects: { type: "number", description: "Max redirects to follow (default: 3)", default: 3 },
            extractLinks: { type: "boolean", description: "Extract all links (default: true)", default: true },
            extractMetadata: { type: "boolean", description: "Extract page metadata (default: true)", default: true },
            extractForms: { type: "boolean", description: "Extract forms (default: true)", default: true },
            cssSelector: { type: "string", description: "Optional CSS class name to match elements" },
          },
          required: ["url"],
        },
      },
      {
        name: "extract_links",
        description: "Fetch a URL and extract all links with their text and hrefs.",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string", description: "URL to fetch" },
            timeout: { type: "number", description: "Timeout in ms (default: 30000)", default: 30000 },
          },
          required: ["url"],
        },
      },
      {
        name: "extract_forms",
        description: "Fetch a URL and extract all forms with their actions, methods, and input fields.",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string", description: "URL to fetch" },
            timeout: { type: "number", description: "Timeout in ms (default: 30000)", default: 30000 },
          },
          required: ["url"],
        },
      },
      {
        name: "get_file_info",
        description: "Get detailed file/directory metadata: size, dates, permissions.",
        inputSchema: {
          type: "object",
          properties: {
            filePath: { type: "string", description: "Path to file or directory" },
          },
          required: ["filePath"],
        },
      },
      {
        name: "directory_tree",
        description: "Display a tree view of a directory structure.",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "Directory path (default: current)", default: "." },
            depth: { type: "number", description: "Max depth (default: 3)", default: 3 },
          },
        },
      },
      {
        name: "move_file",
        description: "Move or rename a file or directory.",
        inputSchema: {
          type: "object",
          properties: {
            source: { type: "string", description: "Source path" },
            destination: { type: "string", description: "Destination path" },
          },
          required: ["source", "destination"],
        },
      },
      {
        name: "copy_file",
        description: "Copy a file or directory.",
        inputSchema: {
          type: "object",
          properties: {
            source: { type: "string", description: "Source path" },
            destination: { type: "string", description: "Destination path" },
          },
          required: ["source", "destination"],
        },
      },
      {
        name: "create_directory",
        description: "Create a new directory.",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "Directory path to create" },
          },
          required: ["path"],
        },
      },
      {
        name: "remove_directory",
        description: "Remove a directory (recursively if non-empty).",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "Directory path to remove" },
            recursive: { type: "boolean", description: "Remove recursively (default: false)", default: false },
          },
          required: ["path"],
        },
      },
      {
        name: "diff_text",
        description: "Compare two text strings and show differences.",
        inputSchema: {
          type: "object",
          properties: {
            text1: { type: "string", description: "First text" },
            text2: { type: "string", description: "Second text" },
            contextLines: { type: "number", description: "Context lines to show (default: 3)", default: 3 },
          },
          required: ["text1", "text2"],
        },
      },
      {
        name: "regex_test",
        description: "Test a regular expression against a string.",
        inputSchema: {
          type: "object",
          properties: {
            pattern: { type: "string", description: "Regex pattern" },
            text: { type: "string", description: "Text to test against" },
            flags: { type: "string", description: "Regex flags (g, i, m, etc.)", default: "" },
          },
          required: ["pattern", "text"],
        },
      },
      {
        name: "generate_password",
        description: "Generate a secure random password.",
        inputSchema: {
          type: "object",
          properties: {
            length: { type: "number", description: "Password length (default: 16)", default: 16 },
            includeUppercase: {
              type: "boolean",
              description: "Include uppercase letters (default: true)",
              default: true,
            },
            includeLowercase: {
              type: "boolean",
              description: "Include lowercase letters (default: true)",
              default: true,
            },
            includeNumbers: { type: "boolean", description: "Include numbers (default: true)", default: true },
            includeSymbols: { type: "boolean", description: "Include symbols (default: true)", default: true },
          },
        },
      },
      {
        name: "jwt_decode",
        description: "Decode a JWT token and show its payload.",
        inputSchema: {
          type: "object",
          properties: {
            token: { type: "string", description: "JWT token to decode" },
          },
          required: ["token"],
        },
      },
      {
        name: "analyze_text",
        description: "Analyze text statistics (word count, character count, sentence count, reading time).",
        inputSchema: {
          type: "object",
          properties: {
            text: { type: "string", description: "Text to analyze" },
          },
          required: ["text"],
        },
      },
      {
        name: "convert_color",
        description: "Convert colors between different formats (hex, rgb, hsl). Returns all formats.",
        inputSchema: {
          type: "object",
          properties: {
            color: { type: "string", description: "Color to convert (e.g., '#ff0000', 'rgb(255,0,0)')" },
          },
          required: ["color"],
        },
      },
      {
        name: "evaluate_math",
        description: "Safely evaluate mathematical expressions.",
        inputSchema: {
          type: "object",
          properties: {
            expression: { type: "string", description: "Mathematical expression to evaluate" },
          },
          required: ["expression"],
        },
      },
      {
        name: "csv_parse",
        description: "Parse CSV text to JSON with support for quoted fields and custom delimiters.",
        inputSchema: {
          type: "object",
          properties: {
            csvText: { type: "string", description: "CSV text to parse" },
            delimiter: { type: "string", description: "Delimiter character (default: comma)", default: "," },
            hasHeader: { type: "boolean", description: "First row is header (default: true)", default: true },
          },
          required: ["csvText"],
        },
      },
      {
        name: "csv_format",
        description: "Convert JSON array to CSV with proper escaping and custom delimiters.",
        inputSchema: {
          type: "object",
          properties: {
            data: {
              type: "array",
              items: { type: "object" },
              description: "JSON array of objects to convert",
            },
            delimiter: { type: "string", description: "Delimiter character (default: comma)", default: "," },
          },
          required: ["data"],
        },
      },
      {
        name: "markdown_table",
        description: "Convert JSON array to markdown table with auto-calculated column widths.",
        inputSchema: {
          type: "object",
          properties: {
            data: {
              type: "array",
              items: { type: "object" },
              description: "JSON array of objects to convert",
            },
          },
          required: ["data"],
        },
      },
      {
        name: "diff_files",
        description: "Compare two files directly and show differences.",
        inputSchema: {
          type: "object",
          properties: {
            filePath1: { type: "string", description: "Path to first file" },
            filePath2: { type: "string", description: "Path to second file" },
            contextLines: { type: "number", description: "Context lines to show (default: 3)", default: 3 },
          },
          required: ["filePath1", "filePath2"],
        },
      },
      {
        name: "create_todo",
        description:
          "Create a new todo item with AI-powered auto-priority detection, due date parsing, time estimation, and dependency tracking.",
        inputSchema: {
          type: "object",
          properties: {
            text: {
              type: "string",
              description:
                "Todo text. Include keywords like 'urgent', 'bug', 'fix' for auto-priority. Include '~30min' or 'due: 2024-05-01' for auto-detection.",
            },
            priority: {
              type: "string",
              description: "Priority (low, medium, high, critical). If omitted, auto-detected from text.",
              default: "medium",
            },
            tags: { type: "array", items: { type: "string" }, description: "Optional tags" },
            blocks: {
              type: "array",
              items: { type: "string" },
              description: "IDs of todos this todo blocks (must complete this first)",
            },
            blockedBy: { type: "array", items: { type: "string" }, description: "IDs of todos that block this todo" },
            dueAt: { type: "string", description: "Due date (YYYY-MM-DD). Auto-detected from text if omitted." },
            estimatedMinutes: {
              type: "number",
              description: "Estimated time in minutes. Auto-detected from text if omitted.",
            },
          },
          required: ["text"],
        },
      },
      {
        name: "list_todos",
        description: "List todos with smart filtering by status, priority, tags, and overdue detection.",
        inputSchema: {
          type: "object",
          properties: {
            done: { type: "boolean", description: "Filter by completion status" },
            priority: { type: "string", description: "Filter by priority (low, medium, high, critical)" },
            tag: { type: "string", description: "Filter by tag" },
            overdue: { type: "boolean", description: "Show only overdue items" },
          },
        },
      },
      {
        name: "complete_todo",
        description: "Mark a todo as completed. Reports which blocked todos are now unblocked.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Todo ID" },
          },
          required: ["id"],
        },
      },
      {
        name: "delete_todo",
        description: "Delete a todo and clean up dependency references.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Todo ID" },
          },
          required: ["id"],
        },
      },
      // Snippets
      {
        name: "save_snippet",
        description: "Save a code snippet with auto-detected language, tags, and description for later retrieval.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Snippet name" },
            code: { type: "string", description: "The code/content to save" },
            language: { type: "string", description: "Override auto-detected language" },
            tags: { type: "array", items: { type: "string" }, description: "Tags for categorization" },
            description: { type: "string", description: "Optional description" },
            filename: { type: "string", description: "Original filename (helps detect language)" },
          },
          required: ["name", "code"],
        },
      },
      {
        name: "find_snippet",
        description: "Search saved snippets by name, content, tags, or language.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
            language: { type: "string", description: "Filter by language" },
            limit: { type: "number", description: "Max results (default: 10)", default: 10 },
          },
          required: ["query"],
        },
      },
      {
        name: "get_snippet",
        description: "Retrieve a specific snippet by ID.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Snippet ID" },
          },
          required: ["id"],
        },
      },
      {
        name: "list_snippets",
        description: "List all saved snippets, optionally filtered by language or tag.",
        inputSchema: {
          type: "object",
          properties: {
            language: { type: "string", description: "Filter by language" },
            tag: { type: "string", description: "Filter by tag" },
          },
        },
      },
      {
        name: "delete_snippet",
        description: "Delete a snippet by ID.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Snippet ID" },
          },
          required: ["id"],
        },
      },
      {
        name: "update_snippet",
        description: "Update an existing snippet's name, code, language, tags, or description.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Snippet ID" },
            name: { type: "string", description: "New name" },
            code: { type: "string", description: "New code" },
            language: { type: "string", description: "New language" },
            tags: { type: "array", items: { type: "string" }, description: "New tags" },
            description: { type: "string", description: "New description" },
          },
          required: ["id"],
        },
      },
      {
        name: "export_snippets",
        description: "Export all snippets to a JSON backup file.",
        inputSchema: {
          type: "object",
          properties: {
            exportPath: {
              type: "string",
              description: "Output path (optional, default: ~/.mcp-devkit/snippets-export.json)",
            },
          },
        },
      },
      {
        name: "import_snippets",
        description: "Import snippets from a JSON backup file. Merges duplicates.",
        inputSchema: {
          type: "object",
          properties: {
            importPath: { type: "string", description: "Path to JSON backup file" },
          },
          required: ["importPath"],
        },
      },
      // Templates
      {
        name: "list_templates",
        description:
          "List available file templates (React component, test file, API route, etc.) with optional filtering.",
        inputSchema: {
          type: "object",
          properties: {
            category: {
              type: "string",
              description:
                "Filter by category (react, backend, testing, python, rust, go, database, devops, documentation)",
            },
            language: { type: "string", description: "Filter by language" },
          },
        },
      },
      {
        name: "get_template",
        description: "Show a template's content and variables.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Template ID" },
          },
          required: ["id"],
        },
      },
      {
        name: "render_template",
        description: "Render a template with variables and optionally write to a file.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Template ID" },
            variables: { type: "object", description: "Variable key-value pairs to substitute {{VariableName}}" },
            outputPath: { type: "string", description: "If provided, writes rendered output to this file path" },
          },
          required: ["id", "variables"],
        },
      },
      {
        name: "create_template",
        description: "Create a custom template with variables for reuse.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Template name" },
            content: { type: "string", description: "Template content with {{VariableName}} placeholders" },
            language: { type: "string", description: "Language identifier" },
            category: { type: "string", description: "Category for grouping" },
            description: { type: "string", description: "What this template generates" },
            variables: { type: "array", items: { type: "string" }, description: "Variable names used in content" },
            tags: { type: "array", items: { type: "string" }, description: "Tags" },
          },
          required: ["name", "content", "language", "category"],
        },
      },
      {
        name: "delete_template",
        description: "Delete a custom template (cannot delete built-ins).",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Template ID" },
          },
          required: ["id"],
        },
      },
      {
        name: "search_templates",
        description: "Search templates by name, description, category, or language.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
          },
          required: ["query"],
        },
      },
      // Batch file operations
      {
        name: "batch_read",
        description: "Read multiple files at once and return results with metadata.",
        inputSchema: {
          type: "object",
          properties: {
            filePaths: { type: "array", items: { type: "string" }, description: "Array of file paths to read" },
          },
          required: ["filePaths"],
        },
      },
      {
        name: "batch_write",
        description: "Write multiple files at once atomically.",
        inputSchema: {
          type: "object",
          properties: {
            writes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  filePath: { type: "string" },
                  content: { type: "string" },
                },
                required: ["filePath", "content"],
              },
              description: "Array of {filePath, content} objects",
            },
          },
          required: ["writes"],
        },
      },
      {
        name: "batch_edit",
        description: "Apply string replacements across multiple files safely.",
        inputSchema: {
          type: "object",
          properties: {
            edits: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  filePath: { type: "string" },
                  replacements: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        oldString: { type: "string" },
                        newString: { type: "string" },
                      },
                      required: ["oldString", "newString"],
                    },
                  },
                },
                required: ["filePath", "replacements"],
              },
              description: "Array of {filePath, replacements[]} objects",
            },
          },
          required: ["edits"],
        },
      },
      {
        name: "batch_delete",
        description: "Delete multiple files at once.",
        inputSchema: {
          type: "object",
          properties: {
            filePaths: { type: "array", items: { type: "string" }, description: "Array of file paths to delete" },
          },
          required: ["filePaths"],
        },
      },
      {
        name: "batch_copy",
        description: "Copy multiple files at once.",
        inputSchema: {
          type: "object",
          properties: {
            copies: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  source: { type: "string" },
                  destination: { type: "string" },
                },
                required: ["source", "destination"],
              },
              description: "Array of {source, destination} objects",
            },
          },
          required: ["copies"],
        },
      },
      {
        name: "batch_move",
        description: "Move/rename multiple files at once with cross-device fallback.",
        inputSchema: {
          type: "object",
          properties: {
            moves: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  source: { type: "string" },
                  destination: { type: "string" },
                },
                required: ["source", "destination"],
              },
              description: "Array of {source, destination} objects",
            },
          },
          required: ["moves"],
        },
      },
      // Archive
      {
        name: "create_archive",
        description: "Create a zip, tar, or tar.gz archive from source paths.",
        inputSchema: {
          type: "object",
          properties: {
            sourcePaths: { type: "array", items: { type: "string" }, description: "Files/directories to archive" },
            outputPath: { type: "string", description: "Output archive path" },
            format: {
              type: "string",
              description: "Archive format: zip, tar, tar.gz (auto-detected from extension if omitted)",
            },
          },
          required: ["sourcePaths", "outputPath"],
        },
      },
      {
        name: "extract_archive",
        description: "Extract a zip, tar, tar.gz, or gz archive.",
        inputSchema: {
          type: "object",
          properties: {
            archivePath: { type: "string", description: "Archive file path" },
            outputDir: { type: "string", description: "Output directory (default: same as archive name)" },
          },
          required: ["archivePath"],
        },
      },
      {
        name: "get_archive_info",
        description: "Get archive metadata: format, entry list, sizes.",
        inputSchema: {
          type: "object",
          properties: {
            archivePath: { type: "string", description: "Archive file path" },
          },
          required: ["archivePath"],
        },
      },
      {
        name: "gzip_file",
        description: "Compress a single file with gzip.",
        inputSchema: {
          type: "object",
          properties: {
            filePath: { type: "string", description: "File to compress" },
            outputPath: { type: "string", description: "Output path (default: file.gz)" },
          },
          required: ["filePath"],
        },
      },
      {
        name: "gunzip_file",
        description: "Decompress a gzip file.",
        inputSchema: {
          type: "object",
          properties: {
            filePath: { type: "string", description: "Gzip file to decompress" },
            outputPath: { type: "string", description: "Output path (default: remove .gz)" },
          },
          required: ["filePath"],
        },
      },
      // Config
      {
        name: "get_config",
        description: "Get MCP DevKit configuration value(s). Returns all config if no section specified.",
        inputSchema: {
          type: "object",
          properties: {
            section: { type: "string", description: "Config section (e.g., preferences, memory, http)" },
            key: { type: "string", description: "Config key within section" },
          },
        },
      },
      {
        name: "set_config",
        description: "Set a configuration value. Values are auto-parsed as JSON if possible.",
        inputSchema: {
          type: "object",
          properties: {
            section: { type: "string", description: "Config section" },
            key: { type: "string", description: "Config key" },
            value: { type: "string", description: "Value to set (JSON-encoded or plain string)" },
          },
          required: ["section", "key", "value"],
        },
      },
      {
        name: "reset_config",
        description: "Reset configuration to defaults. Optionally reset just one section.",
        inputSchema: {
          type: "object",
          properties: {
            section: { type: "string", description: "Section to reset (omit to reset all)" },
          },
        },
      },
      {
        name: "list_config_sections",
        description: "List all config sections and their keys.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "delete_config_key",
        description: "Delete a specific config key.",
        inputSchema: {
          type: "object",
          properties: {
            section: { type: "string", description: "Config section" },
            key: { type: "string", description: "Config key to delete" },
          },
          required: ["section", "key"],
        },
      },
      {
        name: "export_config",
        description: "Export configuration to a JSON file.",
        inputSchema: {
          type: "object",
          properties: {
            exportPath: { type: "string", description: "Output path (optional)" },
          },
        },
      },
      {
        name: "import_config",
        description: "Import configuration from a JSON file.",
        inputSchema: {
          type: "object",
          properties: {
            importPath: { type: "string", description: "Path to config JSON file" },
          },
          required: ["importPath"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const args = request.params.arguments ?? {};
  let result: unknown;

  switch (request.params.name) {
    case "scan_project":
      result = await scanProject(String(args.path), Number(args.depth ?? 5));
      break;
    case "get_project_summary":
      result = await getProjectSummary(String(args.path));
      break;
    case "explain_architecture":
      result = await explainArchitecture(String(args.path));
      break;
    case "remember":
      result = remember(String(args.key), String(args.content), (args.tags as string[]) ?? []);
      break;
    case "recall":
      result = recall(String(args.query), Number(args.limit ?? 10));
      break;
    case "list_memories":
      result = listMemories(args.tag as string | undefined, args.category as string | undefined);
      break;
    case "deduplicate_memories":
      result = await deduplicateMemories();
      break;
    case "summarize_memory":
      result = await summarizeMemory(String(args.key));
      break;
    case "find_related_memories":
      result = await findRelatedMemories(String(args.key), Number(args.threshold ?? 0.3));
      break;
    case "export_memories":
      result = await exportMemories();
      break;
    case "import_memories":
      result = await importMemories(String(args.backupPath));
      break;
    case "get_memory_health":
      result = await getMemoryHealth();
      break;
    case "prune_memories":
      result = await pruneMemories(args.keepCount as number | undefined);
      break;
    case "consolidate_memories":
      result = await consolidateMemories();
      break;
    case "forget_memory":
      result = await forgetMemory(String(args.key));
      break;
    case "update_memory_importance":
      result = await updateMemoryImportance(String(args.key), Number(args.importance));
      break;
    case "search_by_sentiment":
      result = await searchBySentiment(args.sentiment as "positive" | "neutral" | "negative");
      break;
    case "run_command":
      result = await runCommand(
        String(args.command),
        args.cwd as string | undefined,
        args.shell as string | undefined,
        Number(args.timeout ?? 30000),
      );
      break;
    case "git_status":
      result = await gitStatus(args.repoPath as string | undefined);
      break;
    case "git_log":
      result = await gitLog(args.repoPath as string | undefined, Number(args.count ?? 10));
      break;
    case "git_diff":
      result = await gitDiff(args.repoPath as string | undefined, args.target as string | undefined);
      break;
    case "search_code":
      result = await searchCode(
        String(args.query),
        args.path as string | undefined,
        Boolean(args.literal ?? false),
        Number(args.maxResults ?? 50),
        args.ext as string | undefined,
        Boolean(args.caseSensitive ?? false),
        Number(args.contextLines ?? 2),
      );
      break;
    case "get_file_context":
      result = await getFileContext(
        String(args.filePath),
        Number(args.startLine ?? 1),
        args.endLine as number | undefined,
      );
      break;
    case "read_file":
      result = await readFile(String(args.filePath));
      break;
    case "write_file":
      result = await writeFile(String(args.filePath), String(args.content));
      break;
    case "edit_file":
      result = await editFile(String(args.filePath), String(args.oldString), String(args.newString));
      break;
    case "delete_file":
      result = await deleteFile(String(args.filePath));
      break;
    case "list_directory":
      result = await listDirectory(String(args.path ?? "."), Number(args.depth ?? 1));
      break;
    case "http_request":
      result = await httpRequest({
        url: String(args.url),
        method: String(args.method ?? "GET"),
        headers: (args.headers as Record<string, string>) ?? {},
        body: args.body as string | undefined,
        timeout: Number(args.timeout ?? 30000),
        retryCount: Number(args.retryCount ?? 3),
        retryDelay: Number(args.retryDelay ?? 1000),
        cache: Boolean(args.cache ?? false),
        cacheTTL: Number(args.cacheTTL ?? 60000),
        expectJson: Boolean(args.expectJson ?? false),
        validateStatus: args.validateStatus as number | undefined,
      });
      break;
    case "clear_http_cache":
      result = clearHttpCache();
      break;
    case "get_http_cache_stats":
      result = getHttpCacheStats();
      break;
    case "get_http_performance":
      result = getHttpPerformance();
      break;
    case "reset_circuit_breaker":
      result = resetCircuitBreaker(args.domain as string | undefined);
      break;
    case "clear_http_metrics":
      result = clearHttpMetrics();
      break;
    case "list_processes":
      result = await listProcesses();
      break;
    case "kill_process":
      result = await killProcess(String(args.pid));
      break;
    case "get_process_tree":
      result = await getProcessTree(args.pid as string | undefined);
      break;
    case "monitor_process":
      result = await monitorProcess(String(args.pid), Number(args.duration ?? 60000));
      break;
    case "filter_processes":
      result = await filterProcesses({
        name: args.name as string | undefined,
        user: args.user as string | undefined,
        minCpu: args.minCpu as number | undefined,
        minMem: args.minMem as number | undefined,
      });
      break;
    case "get_process_history":
      result = getProcessHistory(args.pid as string | undefined);
      break;
    case "clear_process_history":
      result = clearProcessHistory();
      break;
    case "get_system_info":
      result = getSystemInfo();
      break;
    case "check_port":
      result = await checkPort(Number(args.port), String(args.host ?? "127.0.0.1"));
      break;
    case "get_env_file":
      result = await getEnvFile(String(args.filePath ?? ".env"));
      break;
    case "get_disk_usage":
      result = await getDiskUsage(args.dirPath as string | undefined);
      break;
    case "get_network_info":
      result = getNetworkInfo();
      break;
    case "get_env_var_analysis":
      result = getEnvVarAnalysis();
      break;
    case "get_code_stats":
      result = await getCodeStats(String(args.path ?? "."));
      break;
    case "generate_commit_message":
      result = await generateCommitMessage(args.repoPath as string | undefined);
      break;
    case "validate_commit":
      result = await validateCommit(args.repoPath as string | undefined, args.commitMessage as string | undefined);
      break;
    case "git_add":
      result = await gitAdd(args.files as string[], args.repoPath as string | undefined);
      break;
    case "git_commit":
      result = await gitCommit(String(args.message), args.repoPath as string | undefined);
      break;
    case "git_branches":
      result = await gitBranches(args.repoPath as string | undefined);
      break;
    case "git_checkout":
      result = await gitCheckout(
        String(args.branch),
        Boolean(args.create ?? false),
        args.repoPath as string | undefined,
      );
      break;
    case "git_stash":
      result = await gitStash(args.message as string | undefined, args.repoPath as string | undefined);
      break;
    case "git_stash_pop":
      result = await gitStashPop(Number(args.index ?? 0), args.repoPath as string | undefined);
      break;
    case "git_stash_list":
      result = await gitStashList(args.repoPath as string | undefined);
      break;
    case "git_unstage":
      result = await gitUnstage(args.files as string[], args.repoPath as string | undefined);
      break;
    case "git_restore":
      result = await gitRestore(args.files as string[], args.repoPath as string | undefined);
      break;
    case "git_push":
      result = await gitPush(
        args.remote as string | undefined,
        args.branch as string | undefined,
        Boolean(args.force ?? false),
        args.repoPath as string | undefined,
      );
      break;
    case "git_pull":
      result = await gitPull(
        args.remote as string | undefined,
        args.branch as string | undefined,
        args.repoPath as string | undefined,
      );
      break;
    case "git_remote":
      result = await gitRemote(args.repoPath as string | undefined);
      break;
    case "git_merge":
      result = await gitMerge(
        String(args.branch),
        Boolean(args.noFastForward ?? false),
        args.repoPath as string | undefined,
      );
      break;
    case "git_rebase":
      result = await gitRebase(String(args.branch), args.repoPath as string | undefined);
      break;
    case "git_tags":
      result = await gitTags(args.repoPath as string | undefined);
      break;
    case "git_create_tag":
      result = await gitCreateTag(
        String(args.name),
        args.message as string | undefined,
        args.repoPath as string | undefined,
      );
      break;
    case "git_blame":
      result = await gitBlame(
        String(args.filePath),
        args.startLine as number | undefined,
        args.endLine as number | undefined,
        args.repoPath as string | undefined,
      );
      break;
    case "git_show":
      result = await gitShow(String(args.commit), args.repoPath as string | undefined);
      break;
    case "analyze_branch_health":
      result = await analyzeBranchHealth(args.repoPath as string | undefined);
      break;
    case "analyze_workflow":
      result = await analyzeWorkflow(args.repoPath as string | undefined);
      break;
    case "score_commit_quality":
      result = await scoreCommitQuality(args.repoPath as string | undefined, Number(args.limit ?? 10));
      break;
    case "detect_conflicts":
      result = await detectConflicts(args.repoPath as string | undefined);
      break;
    case "get_git_config":
      result = await getGitConfig(args.repoPath as string | undefined);
      break;
    case "analyze_commit_impact":
      result = await analyzeCommitImpact(args.repoPath as string | undefined, Number(args.limit ?? 10));
      break;
    case "get_author_stats":
      result = await getAuthorStats(args.repoPath as string | undefined, Number(args.limit ?? 20));
      break;
    case "analyze_branch_evolution":
      result = await analyzeBranchEvolution(args.repoPath as string | undefined, args.branch as string | undefined);
      break;
    case "get_repo_insights":
      result = await getRepoInsights(args.repoPath as string | undefined);
      break;
    case "get_package_scripts":
      result = await getPackageScripts(args.path as string | undefined);
      break;
    case "run_package_script":
      result = await runPackageScript(String(args.script), args.path as string | undefined);
      break;
    case "get_dependencies":
      result = await getDependencies(args.path as string | undefined);
      break;
    case "get_package_info":
      result = await getPackageInfo(args.path as string | undefined);
      break;
    case "clear_package_cache":
      result = clearPackageCache();
      break;
    case "get_package_cache_stats":
      result = getPackageCacheStats();
      break;
    case "generate_uuid":
      result = generateUUID();
      break;
    case "hash_text":
      result = hashText(String(args.text), String(args.algorithm ?? "sha256"));
      break;
    case "base64_encode":
      result = base64Encode(String(args.text));
      break;
    case "base64_decode":
      result = base64Decode(String(args.text));
      break;
    case "url_encode":
      result = urlEncode(String(args.text));
      break;
    case "url_decode":
      result = urlDecode(String(args.text));
      break;
    case "format_json":
      result = formatJson(String(args.text));
      break;
    case "get_current_time":
      result = getCurrentTime(args.timezone as string | undefined);
      break;
    case "convert_time":
      result = convertTime(String(args.time), String(args.sourceTimezone), String(args.targetTimezone));
      break;
    case "think":
      result = await think(
        String(args.thought),
        Number(args.thoughtNumber),
        Number(args.totalThoughts),
        Boolean(args.nextThoughtNeeded ?? true),
        Boolean(args.isRevision ?? false),
        args.revisesThought as number | undefined,
        args.branchFromThought as number | undefined,
        args.branchId as string | undefined,
      );
      break;
    case "get_thoughts":
      result = await getThoughts(args.filter as string | undefined);
      break;
    case "clear_thinking":
      result = await clearThinking();
      break;
    case "db_set":
      result = await dbSet(String(args.store), String(args.key), String(args.value));
      break;
    case "db_get":
      result = await dbGet(String(args.store), String(args.key));
      break;
    case "db_delete":
      result = await dbDelete(String(args.store), String(args.key));
      break;
    case "db_list":
      result = await dbList(String(args.store), args.prefix as string | undefined);
      break;
    case "db_query":
      result = await dbQuery(String(args.store), String(args.query));
      break;
    case "db_batch_set":
      result = await dbBatchSet(String(args.store), args.entries as Array<{ key: string; value: string }>);
      break;
    case "db_batch_get":
      result = await dbBatchGet(String(args.store), args.keys as string[]);
      break;
    case "db_clear_store":
      result = await dbClearStore(String(args.store));
      break;
    case "fetch_text":
      result = await fetchText(String(args.url), Number(args.timeout ?? 30000));
      break;
    case "fetch_json":
      result = await fetchJson(String(args.url), Number(args.timeout ?? 30000));
      break;
    case "fetch_structured":
      result = await fetchStructured(String(args.url), {
        timeout: Number(args.timeout ?? 30000),
        followRedirects: Number(args.followRedirects ?? 3),
        extractLinks: Boolean(args.extractLinks ?? true),
        extractMetadata: Boolean(args.extractMetadata ?? true),
        extractForms: Boolean(args.extractForms ?? true),
        cssSelector: args.cssSelector as string | undefined,
      });
      break;
    case "extract_links":
      result = await extractLinks(String(args.url), Number(args.timeout ?? 30000));
      break;
    case "extract_forms":
      result = await extractForms(String(args.url), Number(args.timeout ?? 30000));
      break;
    case "get_file_info":
      result = await getFileInfo(String(args.filePath));
      break;
    case "directory_tree":
      result = await directoryTree(String(args.path ?? "."), Number(args.depth ?? 3));
      break;
    case "move_file":
      result = await moveFile(String(args.source), String(args.destination));
      break;
    case "copy_file":
      result = await copyFile(String(args.source), String(args.destination));
      break;
    case "create_directory":
      result = await createDirectory(String(args.path));
      break;
    case "remove_directory":
      result = await removeDirectory(String(args.path), Boolean(args.recursive ?? false));
      break;
    case "diff_text":
      result = diffText(String(args.text1), String(args.text2), Number(args.contextLines ?? 3));
      break;
    case "regex_test":
      result = regexTest(String(args.pattern), String(args.text), String(args.flags ?? ""));
      break;
    case "generate_password":
      result = generatePassword(Number(args.length ?? 16), {
        uppercase: Boolean(args.includeUppercase ?? true),
        lowercase: Boolean(args.includeLowercase ?? true),
        numbers: Boolean(args.includeNumbers ?? true),
        symbols: Boolean(args.includeSymbols ?? true),
      });
      break;
    case "jwt_decode":
      result = jwtDecode(String(args.token));
      break;
    case "analyze_text":
      result = analyzeText(String(args.text));
      break;
    case "convert_color":
      result = convertColor(String(args.color));
      break;
    case "evaluate_math":
      result = evaluateMath(String(args.expression));
      break;
    case "csv_parse":
      result = csvParse(String(args.csvText), String(args.delimiter ?? ","), Boolean(args.hasHeader ?? true));
      break;
    case "csv_format":
      result = csvFormat(args.data as Record<string, unknown>[], String(args.delimiter ?? ","));
      break;
    case "markdown_table":
      result = markdownTable(args.data as Record<string, unknown>[]);
      break;
    case "diff_files":
      result = await diffFiles(String(args.filePath1), String(args.filePath2), Number(args.contextLines ?? 3));
      break;
    case "create_todo":
      result = await createTodo(
        String(args.text),
        args.priority as "low" | "medium" | "high" | "critical" | undefined,
        (args.tags as string[]) ?? [],
        (args.blocks as string[]) ?? [],
        (args.blockedBy as string[]) ?? [],
        args.dueAt as string | undefined,
        args.estimatedMinutes as number | undefined,
      );
      break;
    case "list_todos":
      result = await listTodos(
        args.filter as { done?: boolean; priority?: string; tag?: string; overdue?: boolean } | undefined,
      );
      break;
    case "complete_todo":
      result = await completeTodo(String(args.id));
      break;
    case "delete_todo":
      result = await deleteTodo(String(args.id));
      break;
    // Snippets
    case "save_snippet":
      result = await saveSnippet(
        String(args.name),
        String(args.code),
        args.language as string | undefined,
        (args.tags as string[]) ?? [],
        args.description as string | undefined,
        args.filename as string | undefined,
      );
      break;
    case "find_snippet":
      result = await findSnippet(String(args.query), args.language as string | undefined, Number(args.limit ?? 10));
      break;
    case "get_snippet":
      result = await getSnippet(String(args.id));
      break;
    case "list_snippets":
      result = await listSnippets(args.language as string | undefined, args.tag as string | undefined);
      break;
    case "delete_snippet":
      result = await deleteSnippet(String(args.id));
      break;
    case "update_snippet":
      result = await updateSnippet(String(args.id), {
        name: args.name as string | undefined,
        code: args.code as string | undefined,
        language: args.language as string | undefined,
        tags: args.tags as string[] | undefined,
        description: args.description as string | undefined,
      });
      break;
    case "export_snippets":
      result = await exportSnippets(args.exportPath as string | undefined);
      break;
    case "import_snippets":
      result = await importSnippets(String(args.importPath));
      break;
    // Templates
    case "list_templates":
      result = await listTemplates(args.category as string | undefined, args.language as string | undefined);
      break;
    case "get_template":
      result = await getTemplate(String(args.id));
      break;
    case "render_template":
      result = await renderTemplateFile(
        String(args.id),
        (args.variables as Record<string, string>) ?? {},
        args.outputPath as string | undefined,
      );
      break;
    case "create_template":
      result = await createTemplate(
        String(args.name),
        String(args.content),
        String(args.language),
        String(args.category),
        args.description as string | undefined,
        (args.variables as string[]) ?? [],
        (args.tags as string[]) ?? [],
      );
      break;
    case "delete_template":
      result = await deleteTemplate(String(args.id));
      break;
    case "search_templates":
      result = await searchTemplates(String(args.query));
      break;
    // Batch file operations
    case "batch_read":
      result = await batchRead(args.filePaths as string[]);
      break;
    case "batch_write":
      result = await batchWrite(args.writes as Array<{ filePath: string; content: string }>);
      break;
    case "batch_edit":
      result = await batchEdit(
        args.edits as Array<{ filePath: string; replacements: Array<{ oldString: string; newString: string }> }>,
      );
      break;
    case "batch_delete":
      result = await batchDelete(args.filePaths as string[]);
      break;
    case "batch_copy":
      result = await batchCopy(args.copies as Array<{ source: string; destination: string }>);
      break;
    case "batch_move":
      result = await batchMove(args.moves as Array<{ source: string; destination: string }>);
      break;
    // Archive
    case "create_archive":
      result = await createArchive(
        args.sourcePaths as string[],
        String(args.outputPath),
        args.format as "zip" | "tar" | "tar.gz" | undefined,
      );
      break;
    case "extract_archive":
      result = await extractArchive(String(args.archivePath), args.outputDir as string | undefined);
      break;
    case "get_archive_info":
      result = await getArchiveInfo(String(args.archivePath));
      break;
    case "gzip_file":
      result = await gzipFile(String(args.filePath), args.outputPath as string | undefined);
      break;
    case "gunzip_file":
      result = await gunzipFile(String(args.filePath), args.outputPath as string | undefined);
      break;
    // Config
    case "get_config":
      result = await getConfig(args.section as string | undefined, args.key as string | undefined);
      break;
    case "set_config":
      result = await setConfig(String(args.section), String(args.key), String(args.value));
      break;
    case "reset_config":
      result = await resetConfig(args.section as string | undefined);
      break;
    case "list_config_sections":
      result = await listConfigSections();
      break;
    case "delete_config_key":
      result = await deleteConfigKey(String(args.section), String(args.key));
      break;
    case "export_config":
      result = await exportConfig(args.exportPath as string | undefined);
      break;
    case "import_config":
      result = await importConfig(String(args.importPath));
      break;
    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }

  return {
    content: [
      {
        type: "text",
        text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
      } as TextContent,
    ],
  };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
