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
