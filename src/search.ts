// BlackWhite — MCP DevKit
import { promises as fs, constants } from "fs";
import path from "path";

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "vendor",
  "__pycache__",
  ".next",
  "dist",
  "build",
  "target",
  ".cargo",
  ".tox",
  ".venv",
  "venv",
  "env",
  ".idea",
  ".vscode",
  "coverage",
  ".nyc_output",
]);

const SKIP_EXTS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".mp3",
  ".mp4",
  ".mov",
  ".avi",
  ".zip",
  ".tar",
  ".gz",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".lockb",
]);

async function canRead(p: string): Promise<boolean> {
  try {
    await fs.access(p, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function readFileSafe(p: string, maxBytes = 50000): Promise<string> {
  try {
    return await fs.readFile(p, "utf-8");
  } catch {
    return "";
  }
}

interface SearchMatch {
  file: string;
  line: number;
  content: string;
}

export async function searchCode(
  query: string,
  searchPath?: string,
  literal = false,
  maxResults = 50
): Promise<string> {
  const root = path.resolve(searchPath || process.cwd());
  const results: SearchMatch[] = [];
  let regex: RegExp;

  try {
    if (literal) {
      regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    } else {
      regex = new RegExp(query, "i");
    }
  } catch {
    // Invalid regex, fall back to literal
    regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  }

  async function walk(dir: string) {
    if (results.length >= maxResults) return;
    if (!canRead(dir)) return;
    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch {
      return;
    }

    for (const name of entries) {
      if (results.length >= maxResults) break;
      if (SKIP_DIRS.has(name)) continue;
      const ext = path.extname(name).toLowerCase();
      if (SKIP_EXTS.has(ext)) continue;

      const full = path.join(dir, name);
      try {
        const stat = await fs.stat(full);
        if (stat.isDirectory()) {
          await walk(full);
        } else if (stat.size < 500_000) {
          const content = await readFileSafe(full, 50000);
          const lines = content.split("\n");
          for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i])) {
              results.push({
                file: full,
                line: i + 1,
                content: lines[i].trim().slice(0, 200),
              });
              if (results.length >= maxResults) break;
            }
          }
        }
      } catch {
        // ignore
      }
    }
  }

  await walk(root);

  if (results.length === 0) return `No matches found for "${query}".`;

  const lines: string[] = [`Found ${results.length} match(es):`, ""];
  for (const r of results) {
    const rel = path.relative(root, r.file);
    lines.push(`${rel}:${r.line}: ${r.content}`);
  }
  return lines.join("\n");
}

export async function getFileContext(
  filePath: string,
  startLine = 1,
  endLine?: number
): Promise<string> {
  const full = path.resolve(filePath);
  try {
    await fs.access(full, constants.R_OK);
  } catch {
    return `Cannot read file: ${full}`;
  }

  const content = await readFileSafe(full, 200_000);
  const lines = content.split("\n");
  const start = Math.max(1, startLine);
  const end = endLine ? Math.min(lines.length, endLine) : lines.length;

  if (start > lines.length) return `File has ${lines.length} lines. Start line ${start} is out of range.`;

  const slice = lines.slice(start - 1, end);
  const header = `--- ${path.basename(full)} (lines ${start}-${end} of ${lines.length}) ---`;
  return [header, ...slice].join("\n");
}
