#!/usr/bin/env node
// BlackWhite — MCP DevKit
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  TextContent,
} from "@modelcontextprotocol/sdk/types.js";

import { scanProject, getProjectSummary, explainArchitecture } from "./scanner.js";
import { remember, recall, listMemories } from "./memory.js";
import { runCommand } from "./terminal.js";
import { gitStatus, gitLog, gitDiff } from "./git-tools.js";
import { searchCode, getFileContext } from "./search.js";
import { readFile, writeFile, editFile, deleteFile, listDirectory } from "./files.js";
import { httpRequest } from "./http.js";
import { listProcesses, killProcess } from "./process.js";
import { getSystemInfo, checkPort, getEnvFile } from "./system.js";
import { getCodeStats } from "./stats.js";

const server = new Server(
  {
    name: "mcp-devkit",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
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
        description:
          "Search stored memories by keyword. Returns the most relevant matches.",
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
        description: "List all stored memory keys and tags.",
        inputSchema: {
          type: "object",
          properties: {
            tag: {
              type: "string",
              description: "Optional tag filter",
            },
          },
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
          "Search code across the project using regex or literal string. Respects .gitignore.",
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
          },
          required: ["query"],
        },
      },
      {
        name: "get_file_context",
        description:
          "Read a file with smart chunking. Returns the file content, or a specific range/lines.",
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
        description: "Replace a unique string in a file. Returns an error if the string is not found or appears more than once.",
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
        description: "Make HTTP GET/POST/PUT/DELETE requests with optional headers and body. Returns status, headers, and body.",
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
          },
          required: ["url"],
        },
      },
      {
        name: "list_processes",
        description: "List running processes (cross-platform: Windows tasklist, Unix ps). Returns PID, name, CPU, memory.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "kill_process",
        description: "Kill a process by PID. Cross-platform (taskkill on Windows, kill on Unix).",
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
        name: "get_system_info",
        description: "Get system information: OS, architecture, memory, CPU count, Node version, environment variables.",
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
        description: "Read a .env file and return variable names with values (secrets masked).",
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
        name: "get_code_stats",
        description: "Analyze code statistics: lines of code, language breakdown, TODO/FIXME counts, file sizes. Cross-platform.",
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
      result = remember(
        String(args.key),
        String(args.content),
        (args.tags as string[]) ?? []
      );
      break;
    case "recall":
      result = recall(String(args.query), Number(args.limit ?? 10));
      break;
    case "list_memories":
      result = listMemories(args.tag as string | undefined);
      break;
    case "run_command":
      result = await runCommand(
        String(args.command),
        args.cwd as string | undefined,
        args.shell as string | undefined,
        Number(args.timeout ?? 30000)
      );
      break;
    case "git_status":
      result = await gitStatus(args.repoPath as string | undefined);
      break;
    case "git_log":
      result = await gitLog(
        args.repoPath as string | undefined,
        Number(args.count ?? 10)
      );
      break;
    case "git_diff":
      result = await gitDiff(
        args.repoPath as string | undefined,
        args.target as string | undefined
      );
      break;
    case "search_code":
      result = await searchCode(
        String(args.query),
        args.path as string | undefined,
        Boolean(args.literal ?? false),
        Number(args.maxResults ?? 50)
      );
      break;
    case "get_file_context":
      result = await getFileContext(
        String(args.filePath),
        Number(args.startLine ?? 1),
        args.endLine as number | undefined
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
      });
      break;
    case "list_processes":
      result = await listProcesses();
      break;
    case "kill_process":
      result = await killProcess(String(args.pid));
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
    case "get_code_stats":
      result = await getCodeStats(String(args.path ?? "."));
      break;
    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }

  return {
    content: [
      {
        type: "text",
        text:
          typeof result === "string" ? result : JSON.stringify(result, null, 2),
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
