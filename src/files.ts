// BlackWhite — MCP DevKit
import { promises as fs, constants } from "fs";
import { createHash } from "crypto";
import path from "path";

export async function readFile(filePath: string): Promise<string> {
  const full = path.resolve(filePath);
  try {
    await fs.access(full, constants.R_OK);
    const data = await fs.readFile(full, "utf-8");
    return data;
  } catch (err: any) {
    return `Error reading file: ${err.message}`;
  }
}

export async function writeFile(filePath: string, content: string): Promise<string> {
  const full = path.resolve(filePath);
  try {
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content, "utf-8");
    return `Wrote ${content.length} bytes to ${full}`;
  } catch (err: any) {
    return `Error writing file: ${err.message}`;
  }
}

export async function editFile(filePath: string, oldString: string, newString: string): Promise<string> {
  const full = path.resolve(filePath);
  try {
    await fs.access(full, constants.R_OK | constants.W_OK);
    const content = await fs.readFile(full, "utf-8");
    const occurrences = content.split(oldString).length - 1;
    if (occurrences === 0) {
      return `Error: old_string not found in file. No changes made.`;
    }
    if (occurrences > 1) {
      return `Error: old_string appears ${occurrences} times. Provide a more unique string.`;
    }
    const updated = content.replace(oldString, newString);
    await fs.writeFile(full, updated, "utf-8");
    return `Edited ${full} (1 replacement). File is now ${updated.length} bytes.`;
  } catch (err: any) {
    return `Error editing file: ${err.message}`;
  }
}

export async function deleteFile(filePath: string): Promise<string> {
  const full = path.resolve(filePath);
  try {
    const stat = await fs.stat(full);
    if (stat.isDirectory()) {
      return `Error: ${full} is a directory. Use delete_directory to remove directories.`;
    }
    await fs.unlink(full);
    return `Deleted file: ${full}`;
  } catch (err: any) {
    return `Error deleting file: ${err.message}`;
  }
}

interface DirEntry {
  name: string;
  type: "file" | "directory";
  size?: number;
}

export async function moveFile(sourcePath: string, destPath: string): Promise<string> {
  const src = path.resolve(sourcePath);
  const dst = path.resolve(destPath);
  try {
    await fs.mkdir(path.dirname(dst), { recursive: true });
    await fs.rename(src, dst);
    return `Moved: ${src} → ${dst}`;
  } catch (err: any) {
    return `Error moving file: ${err.message}`;
  }
}

export async function copyFile(sourcePath: string, destPath: string): Promise<string> {
  const src = path.resolve(sourcePath);
  const dst = path.resolve(destPath);
  try {
    await fs.mkdir(path.dirname(dst), { recursive: true });
    await fs.copyFile(src, dst, fs.constants.COPYFILE_FICLONE);
    return `Copied: ${src} → ${dst}`;
  } catch (err: any) {
    return `Error copying file: ${err.message}`;
  }
}

export async function createDirectory(dirPath: string): Promise<string> {
  const full = path.resolve(dirPath);
  try {
    await fs.mkdir(full, { recursive: true });
    return `Created directory: ${full}`;
  } catch (err: any) {
    return `Error creating directory: ${err.message}`;
  }
}

export async function removeDirectory(dirPath: string, recursive = true): Promise<string> {
  const full = path.resolve(dirPath);
  try {
    await fs.rm(full, { recursive, force: true });
    return `Removed directory: ${full}`;
  } catch (err: any) {
    return `Error removing directory: ${err.message}`;
  }
}

export async function listDirectory(dirPath: string, maxDepth = 1): Promise<string> {
  const full = path.resolve(dirPath);
  const results: Array<{ path: string; entries: DirEntry[] }> = [];

  async function walk(dir: string, depth: number, prefix: string) {
    if (depth > maxDepth) return;
    try {
      await fs.access(dir, constants.R_OK);
    } catch {
      return;
    }
    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch {
      return;
    }
    const items: DirEntry[] = [];
    for (const name of entries) {
      if (name.startsWith(".")) continue;
      try {
        const stat = await fs.stat(path.join(dir, name));
        items.push({
          name,
          type: stat.isDirectory() ? "directory" : "file",
          size: stat.isFile() ? stat.size : undefined,
        });
      } catch {
        // ignore
      }
    }
    results.push({ path: prefix || ".", entries: items });
    for (const item of items) {
      if (item.type === "directory") {
        await walk(path.join(dir, item.name), depth + 1, prefix ? `${prefix}/${item.name}` : item.name);
      }
    }
  }

  await walk(full, 0, "");

  const lines: string[] = [];
  for (const r of results) {
    lines.push(`${r.path}/`);
    for (const e of r.entries) {
      const sizeStr = e.size !== undefined ? ` (${e.size} bytes)` : "";
      lines.push(`  ${e.type === "directory" ? "📁" : "📄"} ${e.name}${sizeStr}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

// ─── Batch Operations ───────────────────────

interface BatchOperation {
  type: "write" | "edit" | "delete" | "move" | "copy";
  filePath: string;
  content?: string;
  oldString?: string;
  newString?: string;
  destPath?: string;
}

export async function batchFileOperations(operations: BatchOperation[]): Promise<string> {
  const results: string[] = [];
  let success = 0;
  let failed = 0;

  for (const op of operations) {
    let result: string;
    try {
      switch (op.type) {
        case "write":
          result = op.content !== undefined ? await writeFile(op.filePath, op.content) : `Error: content required for write`;
          break;
        case "edit":
          result = op.oldString !== undefined && op.newString !== undefined
            ? await editFile(op.filePath, op.oldString, op.newString)
            : `Error: oldString and newString required for edit`;
          break;
        case "delete":
          result = await deleteFile(op.filePath);
          break;
        case "move":
          result = op.destPath ? await moveFile(op.filePath, op.destPath) : `Error: destPath required for move`;
          break;
        case "copy":
          result = op.destPath ? await copyFile(op.filePath, op.destPath) : `Error: destPath required for copy`;
          break;
        default:
          result = `Error: unknown operation type "${(op as any).type}"`;
      }
    } catch (err: any) {
      result = `Error: ${err.message}`;
    }

    if (result.startsWith("Error")) {
      failed++;
      results.push(`[FAIL] ${op.type} ${op.filePath}: ${result}`);
    } else {
      success++;
      results.push(`[OK] ${op.type} ${op.filePath}: ${result}`);
    }
  }

  return [`Batch Results: ${success} succeeded, ${failed} failed`, "", ...results].join("\n");
}

// ─── Duplicate Detection ───────────────────────

interface DuplicateFile {
  hash: string;
  files: Array<{ path: string; size: number }>;
}

export async function findDuplicateFiles(dirPath?: string, maxFiles = 500): Promise<string> {
  const root = path.resolve(dirPath || process.cwd());
  const hashes = new Map<string, DuplicateFile>();
  let scanned = 0;

  async function walk(dir: string) {
    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch { return; }

    for (const name of entries) {
      if (name.startsWith(".") || name === "node_modules" || name === "dist" || name === "build") continue;
      const full = path.join(dir, name);
      try {
        const stat = await fs.stat(full);
        if (stat.isDirectory()) {
          await walk(full);
        } else if (stat.isFile() && stat.size < 5_000_000 && scanned < maxFiles) {
          scanned++;
          const content = await fs.readFile(full);
          const hash = createHash("sha256").update(content).digest("hex").slice(0, 16);
          const existing = hashes.get(hash);
          if (existing) {
            existing.files.push({ path: full, size: stat.size });
          } else {
            hashes.set(hash, { hash, files: [{ path: full, size: stat.size }] });
          }
        }
      } catch { /* ignore */ }
    }
  }

  await walk(root);

  const duplicates = [...hashes.values()].filter((d) => d.files.length > 1);

  if (duplicates.length === 0) {
    return `Scanned ${scanned} files. No duplicates found.`;
  }

  const lines = [
    `# Duplicate Files (${duplicates.length} groups, ${duplicates.reduce((s, d) => s + d.files.length, 0)} files)`,
    `Scanned: ${scanned} files`,
    "",
  ];

  for (const dup of duplicates) {
    lines.push(`## Hash: ${dup.hash}`);
    for (const f of dup.files) {
      const rel = path.relative(root, f.path);
      lines.push(`  ${rel} (${f.size} bytes)`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ─── Content Analysis ───────────────────────

interface FileAnalysis {
  path: string;
  language: string;
  lines: number;
  nonEmptyLines: number;
  commentLines: number;
  todoCount: number;
  fixmeCount: number;
  maxLineLength: number;
  avgLineLength: number;
  complexity: "low" | "medium" | "high";
  functions?: number;
  classes?: number;
  imports?: number;
}

export async function analyzeFileContent(filePath: string): Promise<string> {
  const full = path.resolve(filePath);
  try {
    await fs.access(full, constants.R_OK);
  } catch (err: any) {
    return `Error reading file: ${err.message}`;
  }

  const content = await fs.readFile(full, "utf-8");
  const lines = content.split("\n");
  const ext = path.extname(full).toLowerCase();

  let commentLines = 0;
  let todoCount = 0;
  let fixmeCount = 0;
  let maxLineLength = 0;
  let totalLineLength = 0;
  let nonEmptyLines = 0;
  let functionCount = 0;
  let classCount = 0;
  let importCount = 0;

  const commentPatterns = getCommentPatterns(ext);
  const functionPattern = getFunctionPattern(ext);
  const classPattern = getClassPattern(ext);
  const importPattern = getImportPattern(ext);

  for (const line of lines) {
    const trimmed = line.trim();
    const len = line.length;
    if (len > maxLineLength) maxLineLength = len;
    totalLineLength += len;

    if (trimmed.length > 0) {
      nonEmptyLines++;
      if (commentPatterns.some((p) => p.test(trimmed))) commentLines++;
      if (/TODO/i.test(trimmed)) todoCount++;
      if (/FIXME/i.test(trimmed)) fixmeCount++;
    }

    if (functionPattern && functionPattern.test(trimmed)) functionCount++;
    if (classPattern && classPattern.test(trimmed)) classCount++;
    if (importPattern && importPattern.test(trimmed)) importCount++;
  }

  const avgLineLength = nonEmptyLines > 0 ? Math.round(totalLineLength / nonEmptyLines) : 0;

  // Simple complexity estimation
  let complexity: FileAnalysis["complexity"] = "low";
  const complexityScore = nonEmptyLines * 0.01 + maxLineLength * 0.05 + functionCount * 2;
  if (complexityScore > 50) complexity = "high";
  else if (complexityScore > 20) complexity = "medium";

  const analysis: FileAnalysis = {
    path: full,
    language: ext || "unknown",
    lines: lines.length,
    nonEmptyLines,
    commentLines,
    todoCount,
    fixmeCount,
    maxLineLength,
    avgLineLength,
    complexity,
    functions: functionCount,
    classes: classCount,
    imports: importCount,
  };

  const lines2 = [
    `# File Analysis: ${path.basename(full)}`,
    "",
    `- Path: ${full}`,
    `- Language: ${analysis.language}`,
    `- Total Lines: ${analysis.lines}`,
    `- Non-Empty Lines: ${analysis.nonEmptyLines}`,
    `- Comment Lines: ${analysis.commentLines}`,
    `- Comment Ratio: ${analysis.nonEmptyLines > 0 ? Math.round((analysis.commentLines / analysis.nonEmptyLines) * 100) : 0}%`,
    `- Max Line Length: ${analysis.maxLineLength}`,
    `- Avg Line Length: ${analysis.avgLineLength}`,
    `- Complexity: ${analysis.complexity.toUpperCase()}`,
    analysis.functions !== undefined ? `- Functions: ${analysis.functions}` : "",
    analysis.classes !== undefined ? `- Classes: ${analysis.classes}` : "",
    analysis.imports !== undefined ? `- Imports: ${analysis.imports}` : "",
    `- TODOs: ${analysis.todoCount}`,
    `- FIXMEs: ${analysis.fixmeCount}`,
  ];

  return lines2.filter(Boolean).join("\n");
}

function getCommentPatterns(ext: string): RegExp[] {
  const jsLike = [new RegExp("^\\\\/\\\\/"), new RegExp("^\\\\/\\*"), new RegExp("^\\*"), new RegExp("^\\s*\\*")];
  const pyLike = [new RegExp("^#"), new RegExp('^"""'), new RegExp("^'''")];
  const htmlLike = [new RegExp("^<!--"), new RegExp("^\\s*-->")];
  const map: Record<string, RegExp[]> = {
    ".ts": jsLike, ".tsx": jsLike, ".js": jsLike, ".jsx": jsLike,
    ".py": pyLike, ".rb": [new RegExp("^#")], ".sh": [new RegExp("^#")], ".bash": [new RegExp("^#")],
    ".go": [new RegExp("^\\\\/\\\\/")], ".rs": [new RegExp("^\\\\/\\\\/"), new RegExp("^\\\\/\\*")],
    ".java": jsLike, ".kt": jsLike, ".cs": jsLike,
    ".c": jsLike, ".cpp": jsLike, ".h": jsLike,
    ".swift": [new RegExp("^\\\\/\\\\/")], ".php": [new RegExp("^\\\\/\\\\/"), new RegExp("^#"), new RegExp("^\\\\/\\*")],
    ".html": htmlLike, ".xml": htmlLike, ".vue": htmlLike,
    ".css": [new RegExp("^\\\\/\\*")], ".scss": [new RegExp("^\\\\/\\\\/"), new RegExp("^\\\\/\\*")],
  };
  return map[ext] || [];
}

function getFunctionPattern(ext: string): RegExp | null {
  const map: Record<string, RegExp> = {
    ".ts": /^(export\s+)?(async\s+)?function\s+\w+/, ".tsx": /^(export\s+)?(async\s+)?function\s+\w+/,
    ".js": /^(export\s+)?(async\s+)?function\s+\w+/, ".jsx": /^(export\s+)?(async\s+)?function\s+\w+/,
    ".py": /^def\s+\w+/, ".rb": /^def\s+\w+/, ".php": /^(function|public\s+function|private\s+function)\s+\w+/,
    ".go": /^func\s+\w+/, ".rs": /^fn\s+\w+/, ".swift": /^func\s+\w+/,
    ".java": /^(public|private|protected)?\s*(static)?\s*\w+\s+\w+\s*\(/, ".kt": /^fun\s+\w+/,
    ".c": /^\w+\s+\w+\s*\(/, ".cpp": /^\w+\s+\w+\s*\(/, ".h": /^\w+\s+\w+\s*\(/,
  };
  return map[ext] || null;
}

function getClassPattern(ext: string): RegExp | null {
  const map: Record<string, RegExp> = {
    ".ts": /^(export\s+)?class\s+\w+/, ".tsx": /^(export\s+)?class\s+\w+/,
    ".js": /^(export\s+)?class\s+\w+/, ".jsx": /^(export\s+)?class\s+\w+/,
    ".py": /^class\s+\w+/, ".rb": /^class\s+\w+/, ".php": /^(class|interface|trait)\s+\w+/,
    ".java": /^\s*(public\s+)?(abstract\s+)?class\s+\w+/, ".kt": /^(class|data\s+class|object)\s+\w+/,
    ".rs": /^(struct|enum|trait)\s+\w+/, ".swift": /^(class|struct|enum)\s+\w+/,
    ".cpp": /^(class|struct)\s+\w+/, ".h": /^(class|struct)\s+\w+/,
  };
  return map[ext] || null;
}

function getImportPattern(ext: string): RegExp | null {
  const map: Record<string, RegExp> = {
    ".ts": /^import\s+/, ".tsx": /^import\s+/, ".js": /^import\s+/, ".jsx": /^import\s+/,
    ".py": /^(import|from)\s+/, ".rb": /^require\s+/, ".php": /^(require|include|use)\s+/,
    ".go": /^import\s+/, ".rs": /^use\s+/, ".java": /^import\s+/, ".kt": /^import\s+/,
    ".swift": /^import\s+/, ".c": /^#include\s+/, ".cpp": /^#include\s+/, ".h": /^#include\s+/,
  };
  return map[ext] || null;
}
