// BlackWhite — MCP DevKit
import { promises as fs, constants } from "fs";
import path from "path";

const SKIP_DIRS = new Set([
  ".git", "node_modules", "vendor", "__pycache__",
  ".next", "dist", "build", "target", ".cargo", "coverage",
  ".tox", ".venv", "venv", "env", ".idea", ".vscode",
  ".nyc_output", ".gitignore", ".DS_Store"
]);

const CODE_EXTS: Record<string, string> = {
  ".ts": "TypeScript", ".tsx": "TypeScript React",
  ".js": "JavaScript", ".jsx": "JavaScript React",
  ".py": "Python", ".rs": "Rust", ".go": "Go",
  ".java": "Java", ".kt": "Kotlin", ".scala": "Scala",
  ".rb": "Ruby", ".php": "PHP",
  ".c": "C", ".cpp": "C++", ".h": "C/C++ Header",
  ".cs": "C#", ".swift": "Swift", ".m": "Objective-C",
  ".r": "R", ".sh": "Shell", ".bash": "Shell",
  ".ps1": "PowerShell", ".pl": "Perl", ".lua": "Lua",
  ".html": "HTML", ".css": "CSS", ".scss": "SCSS", ".sass": "Sass",
  ".vue": "Vue", ".svelte": "Svelte", ".astro": "Astro",
  ".json": "JSON", ".xml": "XML", ".yaml": "YAML", ".yml": "YAML",
  ".md": "Markdown", ".sql": "SQL", ".dockerfile": "Dockerfile",
  ".toml": "TOML", ".ini": "INI", ".cfg": "Config",
  ".dart": "Dart", ".elm": "Elm", ".ex": "Elixir",
  ".hs": "Haskell", ".erl": "Erlang", ".fs": "F#",
  ".gd": "GDScript", ".nim": "Nim", ".zig": "Zig",
  ".v": "V", ".clj": "Clojure", ".cr": "Crystal",
  ".dhall": "Dhall", ".nix": "Nix",
};

async function walk(dir: string, stats: Map<string, { files: number; lines: number; bytes: number }>, todoCount: { value: number }, fixmeCount: { value: number }) {
  let entries: string[];
  try {
    await fs.access(dir, constants.R_OK);
    entries = await fs.readdir(dir);
  } catch {
    return;
  }

  for (const name of entries) {
    if (SKIP_DIRS.has(name) || name.startsWith(".")) continue;
    const full = path.join(dir, name);
    try {
      const stat = await fs.stat(full);
      if (stat.isDirectory()) {
        await walk(full, stats, todoCount, fixmeCount);
      } else if (stat.isFile() && stat.size < 2_000_000) {
        const ext = path.extname(name).toLowerCase();
        const lang = CODE_EXTS[ext] || "Other";
        const content = await fs.readFile(full, "utf-8");
        const lines = content.split("\n").length;
        const existing = stats.get(lang) || { files: 0, lines: 0, bytes: 0 };
        existing.files++;
        existing.lines += lines;
        existing.bytes += stat.size;
        stats.set(lang, existing);

        // Count TODOs and FIXMEs
        const upper = content.toUpperCase();
        todoCount.value += (upper.match(/TODO/g) || []).length;
        fixmeCount.value += (upper.match(/FIXME/g) || []).length;
      }
    } catch {
      // ignore binary or unreadable
    }
  }
}

export async function getCodeStats(projectPath: string): Promise<string> {
  const root = path.resolve(projectPath);
  const stats = new Map<string, { files: number; lines: number; bytes: number }>();
  const todoCount = { value: 0 };
  const fixmeCount = { value: 0 };

  await walk(root, stats, todoCount, fixmeCount);

  const totalFiles = Array.from(stats.values()).reduce((sum, s) => sum + s.files, 0);
  const totalLines = Array.from(stats.values()).reduce((sum, s) => sum + s.lines, 0);
  const totalBytes = Array.from(stats.values()).reduce((sum, s) => sum + s.bytes, 0);

  const breakdown = Array.from(stats.entries())
    .sort((a, b) => b[1].lines - a[1].lines)
    .map(([lang, s]) => ({
      language: lang,
      files: s.files,
      lines: s.lines,
      bytes: s.bytes,
      percentage: `${((s.lines / totalLines) * 100).toFixed(1)}%`,
    }));

  const result = {
    project: path.basename(root),
    path: root,
    summary: {
      totalFiles,
      totalLines,
      totalBytes,
      totalLanguages: stats.size,
      todos: todoCount.value,
      fixmes: fixmeCount.value,
    },
    breakdown: breakdown.slice(0, 20),
  };

  return JSON.stringify(result, null, 2);
}
