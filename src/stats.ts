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
  imports: number;
  commentRatio: number;
  hotspot: boolean;
}

interface StatsSnapshot {
  timestamp: number;
  project: string;
  summary: StatsSummary;
  breakdown: LanguageBreakdown[];
  sizeDistribution: SizeDistribution;
  fileMetrics: FileMetrics[];
}

interface StatsSummary {
  totalFiles: number;
  totalLines: number;
  totalBytes: number;
  totalLanguages: number;
  todos: number;
  fixmes: number;
  totalComplexity: number;
  totalFunctions: number;
  totalClasses: number;
  totalImports: number;
  avgComplexity: number;
  avgFunctionsPerFile: number;
  avgCommentRatio: number;
  hotspots: number;
}

interface LanguageBreakdown {
  language: string;
  files: number;
  lines: number;
  bytes: number;
  percentage: string;
  complexityScore: number;
  functionCount: number;
}

interface SizeDistribution {
  small: number;
  medium: number;
  large: number;
  huge: number;
}

const statsHistory: StatsSnapshot[] = [];

async function walk(dir: string,
                   stats: Map<string, { files: number; lines: number; bytes: number; complexity: number; functions: number }>,
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
        const existing = stats.get(lang) || { files: 0, lines: 0, bytes: 0, complexity: 0, functions: 0 };
        existing.files++;
        existing.lines += lines;
        existing.bytes += stat.size;

        // Calculate complexity metrics
        const complexity = calculateComplexity(content, ext);
        const functions = countFunctions(content, ext);
        const classes = countClasses(content, ext);
        const imports = countImports(content, ext);
        const commentRatio = calculateCommentRatio(content, ext);

        existing.complexity += complexity;
        existing.functions += functions;
        stats.set(lang, existing);

        // Count TODOs and FIXMEs
        const upper = content.toUpperCase();
        todoCount.value += (upper.match(/TODO/g) || []).length;
        fixmeCount.value += (upper.match(/FIXME/g) || []).length;

        fileMetrics.push({
          path: full,
          lines,
          bytes: stat.size,
          language: lang,
          complexity,
          functions,
          classes,
          imports,
          commentRatio,
          hotspot: false,
        });
      }
    } catch {
      // ignore binary or unreadable
    }
  }
}

function calculateComplexity(content: string, ext: string): number {
  let complexity = 0;
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (/\b(if|for|while|switch|case|catch|try|throw|return|break|continue|async|await)\b/.test(trimmed)) complexity += 1;
    if (/\b(&&|\|\|)\b/.test(trimmed)) complexity += (trimmed.match(/(&&|\|\|)/g) || []).length;
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
    ".kt": /fun\s+\w+/g,
    ".swift": /func\s+\w+/g,
    ".php": /function\s+\w+/g,
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
    ".kt": /class\s+\w+|object\s+\w+/g,
    ".swift": /class\s+\w+|struct\s+\w+/g,
    ".php": /class\s+\w+/g,
  };

  const pattern = patterns[ext] || /class/g;
  const matches = content.match(pattern);
  return matches ? matches.length : 0;
}

function countImports(content: string, ext: string): number {
  const patterns: Record<string, RegExp> = {
    ".ts": /^import\s+/gm,
    ".tsx": /^import\s+/gm,
    ".js": /^import\s+/gm,
    ".jsx": /^import\s+/gm,
    ".py": /^(import|from)\s+/gm,
    ".rs": /^use\s+/gm,
    ".java": /^import\s+/gm,
    ".go": /^import\s+/gm,
    ".swift": /^import\s+/gm,
  };

  const pattern = patterns[ext];
  if (!pattern) return 0;
  const matches = content.match(pattern);
  return matches ? matches.length : 0;
}

function calculateCommentRatio(content: string, ext: string): number {
  const lines = content.split("\n");
  let commentLines = 0;
  let totalLines = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    totalLines++;

    if (ext === ".py" || ext === ".rb" || ext === ".sh" || ext === ".bash" || ext === ".yml" || ext === ".yaml") {
      if (trimmed.startsWith("#")) commentLines++;
    } else if ([".ts", ".tsx", ".js", ".jsx", ".java", ".kt", ".c", ".cpp", ".h", ".cs", ".swift", ".go", ".rs", ".php"].includes(ext)) {
      if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) commentLines++;
    } else if ([".html", ".xml", ".vue", ".svelte", ".astro"].includes(ext)) {
      if (trimmed.startsWith("<!--")) commentLines++;
    } else if (ext === ".css" || ext === ".scss" || ext === ".sass") {
      if (trimmed.startsWith("/*") || trimmed.startsWith("//")) commentLines++;
    }
  }

  return totalLines > 0 ? Math.round((commentLines / totalLines) * 100) : 0;
}

export async function getCodeStats(projectPath: string): Promise<string> {
  const root = path.resolve(projectPath);
  const stats = new Map<string, { files: number; lines: number; bytes: number; complexity: number; functions: number }>();
  const todoCount = { value: 0 };
  const fixmeCount = { value: 0 };
  const fileMetrics: FileMetrics[] = [];

  await walk(root, stats, todoCount, fixmeCount, fileMetrics);

  const totalFiles = Array.from(stats.values()).reduce((sum, s) => sum + s.files, 0);
  const totalLines = Array.from(stats.values()).reduce((sum, s) => sum + s.lines, 0);
  const totalBytes = Array.from(stats.values()).reduce((sum, s) => sum + s.bytes, 0);
  const totalComplexity = Array.from(stats.values()).reduce((sum, s) => sum + s.complexity, 0);
  const totalFunctions = Array.from(stats.values()).reduce((sum, s) => sum + s.functions, 0);
  const totalClasses = fileMetrics.reduce((sum, f) => sum + f.classes, 0);
  const totalImports = fileMetrics.reduce((sum, f) => sum + f.imports, 0);
  const avgCommentRatio = fileMetrics.length > 0
    ? Math.round(fileMetrics.reduce((sum, f) => sum + f.commentRatio, 0) / fileMetrics.length)
    : 0;

  // Calculate hotspots: top 20% by complexity or files with zero comments in large files
  const sortedByComplexity = [...fileMetrics].sort((a, b) => b.complexity - a.complexity);
  const hotspotThreshold = sortedByComplexity.length > 0 ? sortedByComplexity[Math.floor(sortedByComplexity.length * 0.2)]?.complexity || 0 : 0;

  for (const fm of fileMetrics) {
    fm.hotspot = fm.complexity >= hotspotThreshold || (fm.lines > 200 && fm.commentRatio < 5);
  }
  const hotspots = fileMetrics.filter((f) => f.hotspot).length;

  const breakdown: LanguageBreakdown[] = Array.from(stats.entries())
    .sort((a, b) => b[1].lines - a[1].lines)
    .map(([lang, s]) => ({
      language: lang,
      files: s.files,
      lines: s.lines,
      bytes: s.bytes,
      percentage: `${((s.lines / totalLines) * 100).toFixed(1)}%`,
      complexityScore: s.complexity,
      functionCount: s.functions,
    }));

  const sizeDistribution: SizeDistribution = {
    small: fileMetrics.filter((f) => f.bytes < 1000).length,
    medium: fileMetrics.filter((f) => f.bytes >= 1000 && f.bytes < 10000).length,
    large: fileMetrics.filter((f) => f.bytes >= 10000 && f.bytes < 100000).length,
    huge: fileMetrics.filter((f) => f.bytes >= 100000).length,
  };

  const summary: StatsSummary = {
    totalFiles,
    totalLines,
    totalBytes,
    totalLanguages: stats.size,
    todos: todoCount.value,
    fixmes: fixmeCount.value,
    totalComplexity,
    totalFunctions,
    totalClasses,
    totalImports,
    avgComplexity: totalFiles > 0 ? parseFloat((totalComplexity / totalFiles).toFixed(2)) : 0,
    avgFunctionsPerFile: totalFiles > 0 ? parseFloat((totalFunctions / totalFiles).toFixed(2)) : 0,
    avgCommentRatio,
    hotspots,
  };

  const snapshot: StatsSnapshot = {
    timestamp: Date.now(),
    project: path.basename(root),
    summary,
    breakdown: breakdown.slice(0, 20),
    sizeDistribution,
    fileMetrics,
  };

  statsHistory.push(snapshot);
  if (statsHistory.length > 50) {
    statsHistory.shift();
  }

  return JSON.stringify({
    project: path.basename(root),
    path: root,
    summary,
    breakdown: breakdown.slice(0, 20),
    sizeDistribution,
    topComplexFiles: fileMetrics
      .sort((a, b) => b.complexity - a.complexity)
      .slice(0, 10)
      .map((f) => ({
        path: path.relative(root, f.path),
        complexity: f.complexity,
        lines: f.lines,
        language: f.language,
        commentRatio: f.commentRatio,
        hotspot: f.hotspot,
      })),
    hotspots: fileMetrics
      .filter((f) => f.hotspot)
      .sort((a, b) => b.complexity - a.complexity)
      .slice(0, 10)
      .map((f) => ({
        path: path.relative(root, f.path),
        complexity: f.complexity,
        lines: f.lines,
        language: f.language,
        commentRatio: f.commentRatio,
        reason: f.lines > 200 && f.commentRatio < 5 ? "Large file with low comments" : "High complexity",
      })),
    architectureMetrics: {
      modularity: calculateModularity(fileMetrics),
      cohesion: calculateCohesion(fileMetrics),
      coupling: calculateCoupling(fileMetrics),
    },
  }, null, 2);
}

function calculateModularity(fileMetrics: FileMetrics[]): number {
  if (fileMetrics.length === 0) return 0;
  const avgSize = fileMetrics.reduce((sum, f) => sum + f.lines, 0) / fileMetrics.length;
  const variance = fileMetrics.reduce((sum, f) => sum + Math.pow(f.lines - avgSize, 2), 0) / fileMetrics.length;
  const stdDev = Math.sqrt(variance);
  const score = Math.max(0, Math.min(100, Math.round(100 - (stdDev / (avgSize || 1)) * 100)));
  return score;
}

function calculateCohesion(fileMetrics: FileMetrics[]): number {
  if (fileMetrics.length === 0) return 0;
  const languages = new Set(fileMetrics.map((f) => f.language)).size;
  const score = Math.max(0, Math.min(100, Math.round(100 - (languages - 1) * 15)));
  return score;
}

function calculateCoupling(fileMetrics: FileMetrics[]): number {
  if (fileMetrics.length === 0) return 0;
  const avgImports = fileMetrics.reduce((sum, f) => sum + f.imports, 0) / fileMetrics.length;
  const score = Math.max(0, Math.min(100, Math.round(100 - avgImports * 5)));
  return score;
}

export function getStatsTrend(limit = 10): string {
  const recent = statsHistory.slice(-limit);

  if (recent.length < 2) {
    return JSON.stringify({ error: "Not enough history data for trend analysis" }, null, 2);
  }

  const oldest = recent[0].summary;
  const newest = recent[recent.length - 1].summary;

  const lineChange = newest.totalLines - oldest.totalLines;
  const fileChange = newest.totalFiles - oldest.totalFiles;
  const todoChange = newest.todos - oldest.todos;
  const complexityChange = newest.totalComplexity - oldest.totalComplexity;
  const functionChange = newest.totalFunctions - oldest.totalFunctions;
  const hotspotChange = newest.hotspots - oldest.hotspots;

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
      complexity: complexityChange,
      functions: functionChange,
      hotspots: hotspotChange,
    },
    growthRate: {
      lines: oldest.totalLines > 0 ? `${((lineChange / oldest.totalLines) * 100).toFixed(2)}%` : "N/A",
      files: oldest.totalFiles > 0 ? `${((fileChange / oldest.totalFiles) * 100).toFixed(2)}%` : "N/A",
    },
    healthIndicators: {
      complexityPerFile: newest.avgComplexity,
      functionsPerFile: newest.avgFunctionsPerFile,
      commentCoverage: `${newest.avgCommentRatio}%`,
      hotspots: newest.hotspots,
      hotspotRatio: newest.totalFiles > 0 ? `${((newest.hotspots / newest.totalFiles) * 100).toFixed(1)}%` : "0%",
    },
  };

  return JSON.stringify(trend, null, 2);
}

export async function detectAnomalies(projectPath: string): Promise<string> {
  const root = path.resolve(projectPath);
  const stats = new Map<string, { files: number; lines: number; bytes: number; complexity: number; functions: number }>();
  const todoCount = { value: 0 };
  const fixmeCount = { value: 0 };
  const fileMetrics: FileMetrics[] = [];

  await walk(root, stats, todoCount, fixmeCount, fileMetrics);

  const anomalies: Array<{ file: string; type: string; severity: "low" | "medium" | "high" | "critical"; message: string; metric: number }> = [];

  if (fileMetrics.length === 0) {
    return JSON.stringify({ anomalies: [], message: "No files to analyze" }, null, 2);
  }

  const avgLines = fileMetrics.reduce((sum, f) => sum + f.lines, 0) / fileMetrics.length;
  const avgComplexity = fileMetrics.reduce((sum, f) => sum + f.complexity, 0) / fileMetrics.length;
  const avgCommentRatio = fileMetrics.reduce((sum, f) => sum + f.commentRatio, 0) / fileMetrics.length;
  const avgFunctions = fileMetrics.reduce((sum, f) => sum + f.functions, 0) / fileMetrics.length;

  for (const fm of fileMetrics) {
    const relPath = path.relative(root, fm.path);

    if (fm.lines > avgLines * 5 && fm.lines > 300) {
      anomalies.push({
        file: relPath,
        type: "oversized_file",
        severity: fm.lines > 1000 ? "high" : "medium",
        message: `File is ${(fm.lines / avgLines).toFixed(1)}x larger than average (${fm.lines} vs ${Math.round(avgLines)} avg lines)`,
        metric: fm.lines,
      });
    }

    if (fm.complexity > avgComplexity * 4 && fm.complexity > 50) {
      anomalies.push({
        file: relPath,
        type: "high_complexity",
        severity: fm.complexity > 200 ? "critical" : "high",
        message: `Complexity is ${(fm.complexity / avgComplexity).toFixed(1)}x higher than average (${fm.complexity} vs ${Math.round(avgComplexity)} avg)`,
        metric: fm.complexity,
      });
    }

    if (fm.lines > 50 && fm.commentRatio < 5 && fm.language !== "JSON" && fm.language !== "Markdown" && fm.language !== "YAML") {
      anomalies.push({
        file: relPath,
        type: "low_comments",
        severity: fm.commentRatio === 0 ? "medium" : "low",
        message: `File has ${fm.commentRatio}% comment coverage (avg is ${Math.round(avgCommentRatio)}%)`,
        metric: fm.commentRatio,
      });
    }

    if (fm.functions > avgFunctions * 5 && fm.functions > 15) {
      anomalies.push({
        file: relPath,
        type: "too_many_functions",
        severity: "medium",
        message: `File has ${fm.functions} functions (${(fm.functions / avgFunctions).toFixed(1)}x more than avg ${Math.round(avgFunctions)})`,
        metric: fm.functions,
      });
    }

    if (fm.classes > 3) {
      anomalies.push({
        file: relPath,
        type: "god_file",
        severity: "high",
        message: `File contains ${fm.classes} classes/structs — consider splitting`,
        metric: fm.classes,
      });
    }
  }

  const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
  anomalies.sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity] || b.metric - a.metric);

  const summary = {
    totalAnomalies: anomalies.length,
    critical: anomalies.filter((a) => a.severity === "critical").length,
    high: anomalies.filter((a) => a.severity === "high").length,
    medium: anomalies.filter((a) => a.severity === "medium").length,
    low: anomalies.filter((a) => a.severity === "low").length,
    avgLines: Math.round(avgLines),
    avgComplexity: Math.round(avgComplexity),
    avgCommentRatio: Math.round(avgCommentRatio),
  };

  return JSON.stringify({
    summary,
    anomalies: anomalies.slice(0, 20),
    recommendations: generateAnomalyRecommendations(anomalies, summary),
  }, null, 2);
}

function generateAnomalyRecommendations(
  anomalies: Array<{ file: string; type: string; severity: string; message: string }>,
  summary: { totalAnomalies: number; critical: number; high: number; medium: number; low: number }
): string[] {
  const recommendations: string[] = [];

  const types = new Set(anomalies.map((a) => a.type));

  if (summary.critical > 0) {
    recommendations.push(`Address ${summary.critical} critical anomalies immediately — they indicate serious maintainability issues.`);
  }
  if (types.has("oversized_file")) {
    recommendations.push("Consider splitting oversized files into smaller, focused modules.");
  }
  if (types.has("high_complexity")) {
    recommendations.push("Refactor complex files by extracting functions, reducing nesting, or simplifying control flow.");
  }
  if (types.has("low_comments")) {
    recommendations.push("Add inline documentation to complex logic and public APIs.");
  }
  if (types.has("too_many_functions") || types.has("god_file")) {
    recommendations.push("Apply Single Responsibility Principle — split files with too many classes or functions.");
  }
  if (summary.totalAnomalies === 0) {
    recommendations.push("Codebase looks healthy! No significant anomalies detected.");
  }

  return recommendations;
}

export function clearStatsHistory(): string {
  statsHistory.length = 0;
  return "Stats history cleared.";
}

export function getFileSizeDistribution(projectPath: string): Promise<string> {
  return getCodeStats(projectPath).then((result) => {
    const parsed = JSON.parse(result);
    return JSON.stringify({
      project: parsed.project,
      distribution: parsed.sizeDistribution,
      totalFiles: parsed.summary.totalFiles,
    }, null, 2);
  });
}
