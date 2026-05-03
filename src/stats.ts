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

interface FileMetrics {
  path: string;
  lines: number;
  bytes: number;
  language: string;
  complexity: number;
  functions: number;
  classes: number;
}

interface StatsHistory {
  timestamp: number;
  stats: any;
}

const statsHistory: StatsHistory[] = [];

async function walk(dir: string, 
                   stats: Map<string, { files: number; lines: number; bytes: number }>, 
                   todoCount: { value: number }, 
                   fixmeCount: { value: number },
                   fileMetrics: FileMetrics[]) {
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
        await walk(full, stats, todoCount, fixmeCount, fileMetrics);
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

        // Calculate complexity metrics
        const complexity = calculateComplexity(content, ext);
        const functions = countFunctions(content, ext);
        const classes = countClasses(content, ext);
        
        fileMetrics.push({
          path: full,
          lines,
          bytes: stat.size,
          language: lang,
          complexity,
          functions,
          classes,
        });
      }
    } catch {
      // ignore binary or unreadable
    }
  }
}

function calculateComplexity(content: string, ext: string): number {
  // Simple complexity heuristic based on nesting and control structures
  let complexity = 0;
  const lines = content.split("\n");
  
  for (const line of lines) {
    const trimmed = line.trim();
    // Count control structures
    if (/if|for|while|switch|case|catch|try/.test(trimmed)) complexity += 1;
    // Count nested structures (indentation)
    const indent = line.search(/\S/);
    if (indent > 0) complexity += Math.floor(indent / 2);
  }
  
  return complexity;
}

function countFunctions(content: string, ext: string): number {
  const patterns: Record<string, RegExp> = {
    ".ts": /function\s+\w+|const\s+\w+\s*=\s*\(|=>/g,
    ".js": /function\s+\w+|const\s+\w+\s*=\s*\(|=>/g,
    ".py": /def\s+\w+/g,
    ".rs": /fn\s+\w+/g,
    ".go": /func\s+\w+/g,
    ".java": /public|private|protected\s+\w+\s+\w+\s*\(/g,
  };
  
  const pattern = patterns[ext] || /function|def|fn|func/g;
  const matches = content.match(pattern);
  return matches ? matches.length : 0;
}

function countClasses(content: string, ext: string): number {
  const patterns: Record<string, RegExp> = {
    ".ts": /class\s+\w+/g,
    ".js": /class\s+\w+/g,
    ".py": /class\s+\w+/g,
    ".rs": /struct\s+\w+|enum\s+\w+/g,
    ".java": /class\s+\w+/g,
  };
  
  const pattern = patterns[ext] || /class/g;
  const matches = content.match(pattern);
  return matches ? matches.length : 0;
}

export async function getCodeStats(projectPath: string): Promise<string> {
  const root = path.resolve(projectPath);
  const stats = new Map<string, { files: number; lines: number; bytes: number }>();
  const todoCount = { value: 0 };
  const fixmeCount = { value: 0 };
  const fileMetrics: FileMetrics[] = [];

  await walk(root, stats, todoCount, fixmeCount, fileMetrics);

  const totalFiles = Array.from(stats.values()).reduce((sum, s) => sum + s.files, 0);
  const totalLines = Array.from(stats.values()).reduce((sum, s) => sum + s.lines, 0);
  const totalBytes = Array.from(stats.values()).reduce((sum, s) => sum + s.bytes, 0);
  const totalComplexity = fileMetrics.reduce((sum, f) => sum + f.complexity, 0);
  const totalFunctions = fileMetrics.reduce((sum, f) => sum + f.functions, 0);
  const totalClasses = fileMetrics.reduce((sum, f) => sum + f.classes, 0);

  const breakdown = Array.from(stats.entries())
    .sort((a, b) => b[1].lines - a[1].lines)
    .map(([lang, s]) => ({
      language: lang,
      files: s.files,
      lines: s.lines,
      bytes: s.bytes,
      percentage: `${((s.lines / totalLines) * 100).toFixed(1)}%`,
    }));

  // File size distribution
  const sizeDistribution = {
    small: fileMetrics.filter(f => f.bytes < 1000).length,
    medium: fileMetrics.filter(f => f.bytes >= 1000 && f.bytes < 10000).length,
    large: fileMetrics.filter(f => f.bytes >= 10000 && f.bytes < 100000).length,
    huge: fileMetrics.filter(f => f.bytes >= 100000).length,
  };

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
      totalComplexity,
      totalFunctions,
      totalClasses,
      averageComplexity: totalFiles > 0 ? (totalComplexity / totalFiles).toFixed(2) : 0,
      averageFunctionsPerFile: totalFiles > 0 ? (totalFunctions / totalFiles).toFixed(2) : 0,
    },
    breakdown: breakdown.slice(0, 20),
    sizeDistribution,
    topComplexFiles: fileMetrics
      .sort((a, b) => b.complexity - a.complexity)
      .slice(0, 10)
      .map(f => ({
        path: f.path,
        complexity: f.complexity,
        lines: f.lines,
        language: f.language,
      })),
  };

  // Save to history
  statsHistory.push({
    timestamp: Date.now(),
    stats: result,
  });
  
  // Keep only last 50 entries
  if (statsHistory.length > 50) {
    statsHistory.shift();
  }

  return JSON.stringify(result, null, 2);
}

export function getStatsTrend(limit = 10): string {
  const recent = statsHistory.slice(-limit);
  
  if (recent.length < 2) {
    return JSON.stringify({ error: "Not enough history data for trend analysis" }, null, 2);
  }
  
  const oldest = recent[0].stats.summary;
  const newest = recent[recent.length - 1].stats.summary;
  
  const lineChange = newest.totalLines - oldest.totalLines;
  const fileChange = newest.totalFiles - oldest.totalFiles;
  const todoChange = newest.todos - oldest.todos;
  const complexityChange = parseFloat(newest.totalComplexity) - parseFloat(oldest.totalComplexity);
  
  const trend = {
    period: {
      start: new Date(recent[0].timestamp).toISOString(),
      end: new Date(recent[recent.length - 1].timestamp).toISOString(),
      snapshots: recent.length,
    },
    changes: {
      lines: lineChange,
      files: fileChange,
      todos: todoChange,
      complexity: complexityChange.toFixed(2),
    },
    growthRate: {
      lines: `${((lineChange / oldest.totalLines) * 100).toFixed(2)}%`,
      files: `${((fileChange / oldest.totalFiles) * 100).toFixed(2)}%`,
    },
  };
  
  return JSON.stringify(trend, null, 2);
}

export function clearStatsHistory(): string {
  statsHistory.length = 0;
  return "Stats history cleared.";
}

export function getFileSizeDistribution(projectPath: string): Promise<string> {
  return getCodeStats(projectPath).then(result => {
    const parsed = JSON.parse(result);
    return JSON.stringify({
      project: parsed.project,
      distribution: parsed.sizeDistribution,
      totalFiles: parsed.summary.totalFiles,
    }, null, 2);
  });
}
