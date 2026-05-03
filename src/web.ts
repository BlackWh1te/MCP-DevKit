// BlackWhite — MCP DevKit
import { promises as fs, constants } from "fs";
import path from "path";

export async function fetchText(url: string, timeout = 30000): Promise<string> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "MCP-DevKit/1.0 (fetch-text)",
        Accept: "text/html,text/plain,application/json",
      },
    });
    clearTimeout(timer);

    if (!response.ok) {
      return `Error: HTTP ${response.status} ${response.statusText}`;
    }

    const contentType = response.headers.get("content-type") || "";
    let body: string;

    if (contentType.includes("application/json")) {
      body = JSON.stringify(await response.json(), null, 2);
    } else {
      body = await response.text();
    }

    // Strip HTML tags if HTML
    if (contentType.includes("text/html")) {
      body = body
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    return body.slice(0, 50000) + (body.length > 50000 ? "\n... (truncated)" : "");
  } catch (err: any) {
    if (err.name === "AbortError") return "Error: Request timed out";
    return `Error: ${err.message}`;
  }
}

export async function fetchJson(url: string, timeout = 30000): Promise<string> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": "MCP-DevKit/1.0" },
    });
    clearTimeout(timer);

    if (!response.ok) {
      return JSON.stringify({ error: `HTTP ${response.status} ${response.statusText}` }, null, 2);
    }

    const body = await response.json();
    return JSON.stringify(body, null, 2).slice(0, 50000);
  } catch (err: any) {
    if (err.name === "AbortError") return JSON.stringify({ error: "Request timed out" }, null, 2);
    return JSON.stringify({ error: err.message }, null, 2);
  }
}

interface FileInfo {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  modified?: string;
}

export async function getFileInfo(filePath: string): Promise<string> {
  const full = path.resolve(filePath);
  try {
    await fs.access(full, constants.R_OK);
    const stat = await fs.stat(full);
    const info = {
      path: full,
      name: path.basename(full),
      type: stat.isDirectory() ? "directory" : "file",
      size: stat.size,
      created: stat.birthtime.toISOString(),
      modified: stat.mtime.toISOString(),
      accessed: stat.atime.toISOString(),
      permissions: stat.mode.toString(8),
      isSymbolicLink: stat.isSymbolicLink(),
    };
    return JSON.stringify(info, null, 2);
  } catch (err: any) {
    return `Error: ${err.message}`;
  }
}

export async function directoryTree(dirPath: string, maxDepth = 3): Promise<string> {
  const root = path.resolve(dirPath);

  async function walk(dir: string, depth: number, prefix: string): Promise<string[]> {
    if (depth > maxDepth) return [];
    let entries: string[];
    try {
      await fs.access(dir, constants.R_OK);
      entries = await fs.readdir(dir);
    } catch {
      return [];
    }

    const lines: string[] = [];
    const filtered = entries
      .filter((e) => !e.startsWith(".") && e !== "node_modules" && e !== "dist" && e !== "build")
      .sort((a, b) => a.localeCompare(b));

    for (let i = 0; i < filtered.length; i++) {
      const name = filtered[i];
      const isLast = i === filtered.length - 1;
      const full = path.join(dir, name);
      const connector = isLast ? "└── " : "├── ";
      const childPrefix = isLast ? "    " : "│   ";

      try {
        const stat = await fs.stat(full);
        if (stat.isDirectory()) {
          lines.push(`${prefix}${connector}${name}/`);
          lines.push(...(await walk(full, depth + 1, prefix + childPrefix)));
        } else {
          lines.push(`${prefix}${connector}${name} (${stat.size} bytes)`);
        }
      } catch {
        // ignore
      }
    }
    return lines;
  }

  const lines = await walk(root, 0, "");
  return [`${root}/`, ...lines].join("\n");
}
