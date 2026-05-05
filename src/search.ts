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
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico",
  ".woff", ".woff2", ".ttf", ".eot",
  ".mp3", ".mp4", ".mov", ".avi",
  ".zip", ".tar", ".gz",
  ".exe", ".dll", ".so", ".dylib", ".lockb",
]);

const CODE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".py", ".rs", ".go",
  ".java", ".kt", ".rb", ".php", ".c", ".cpp", ".h",
  ".cs", ".swift", ".m", ".scala", ".dart", ".elm",
  ".hs", ".erl", ".fs", ".gd", ".nim", ".zig", ".v",
  ".clj", ".cr", ".vue", ".svelte", ".astro",
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
  contextBefore: string[];
  contextAfter: string[];
  score: number;
  matchType: "definition" | "usage" | "import" | "comment" | "string" | "other";
  symbolName?: string;
}

interface SymbolDefinition {
  name: string;
  file: string;
  line: number;
  type: "function" | "class" | "interface" | "variable" | "type" | "unknown";
  signature?: string;
  references: SymbolReference[];
}

interface SymbolReference {
  file: string;
  line: number;
  context: string;
  type: "call" | "import" | "usage" | "definition";
}

interface FileRelationship {
  file: string;
  imports: string[];
  importedBy: string[];
  relatedFiles: string[]; // files sharing symbols
  sharedSymbols: string[];
}

interface CrossReferenceResult {
  definitions: SymbolDefinition[];
  references: SymbolReference[];
  fileRelationships: FileRelationship[];
}

export async function searchCode(
  query: string,
  searchPath?: string,
  literal = false,
  maxResults = 50,
  ext?: string,
  caseSensitive = false,
  contextLines = 2
): Promise<string> {
  const root = path.resolve(searchPath || process.cwd());
  const results: SearchMatch[] = [];
  let regex: RegExp;

  try {
    if (literal) {
      regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), caseSensitive ? "" : "i");
    } else {
      regex = new RegExp(query, caseSensitive ? "" : "i");
    }
  } catch {
    regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), caseSensitive ? "" : "i");
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
      const fext = path.extname(name).toLowerCase();
      if (SKIP_EXTS.has(fext)) continue;
      if (ext && fext !== ext.toLowerCase() && !name.toLowerCase().endsWith(ext.toLowerCase())) continue;

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
              const line = lines[i];
              const matchType = detectMatchType(line, fext);
              const symbolName = extractSymbolName(line, matchType);

              const exactMatch = line.toLowerCase() === query.toLowerCase();
              const wordBoundary = line.match(new RegExp(`\\b${query}\\b`, caseSensitive ? "" : "i"));
              const matchCount = (line.match(new RegExp(query, caseSensitive ? "" : "gi")) || []).length;

              let score = 1;
              if (exactMatch) score += 10;
              if (wordBoundary) score += 5;
              score += matchCount;
              if (line.includes("TODO") || line.includes("FIXME")) score += 2;
              if (matchType === "definition") score += 8;
              if (matchType === "import") score += 3;

              const contextBefore: string[] = [];
              const contextAfter: string[] = [];
              for (let c = 1; c <= contextLines; c++) {
                if (i - c >= 0) contextBefore.unshift(lines[i - c].trim().slice(0, 200));
                if (i + c < lines.length) contextAfter.push(lines[i + c].trim().slice(0, 200));
              }

              results.push({
                file: full,
                line: i + 1,
                content: lines[i].trim().slice(0, 200),
                contextBefore,
                contextAfter,
                score,
                matchType,
                symbolName,
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

  results.sort((a, b) => b.score - a.score);

  const lines: string[] = [`Found ${results.length} match(es) for "${query}":`, ""];
  for (const r of results) {
    const rel = path.relative(root, r.file);
    const typeStr = r.matchType !== "other" ? ` [${r.matchType}]` : "";
    const symStr = r.symbolName ? ` (${r.symbolName})` : "";
    lines.push(`${rel}:${r.line}${typeStr}${symStr} [score: ${r.score}]`);
    lines.push(`  ${r.content}`);
    if (r.contextBefore.length > 0) {
      lines.push(`  Before: ${r.contextBefore.join(" | ")}`);
    }
    if (r.contextAfter.length > 0) {
      lines.push(`  After:  ${r.contextAfter.join(" | ")}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function detectMatchType(line: string, ext: string): SearchMatch["matchType"] {
  const trimmed = line.trim();
  if (trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("/*") || trimmed.startsWith("*")) {
    return "comment";
  }
  if (trimmed.startsWith("import ") || trimmed.startsWith("from ") || trimmed.startsWith("require(") || trimmed.startsWith("using ") || trimmed.startsWith("include ")) {
    return "import";
  }
  if (trimmed.includes('"') || trimmed.includes("'") || trimmed.includes("`")) {
    const quoteCount = (trimmed.match(/"/g) || []).length + (trimmed.match(/'/g) || []).length;
    if (quoteCount >= 2) return "string";
  }

  // Definition detection by language
  const defPatterns: Record<string, RegExp> = {
    ".ts": /^(export\s+)?(function|class|interface|type|enum|const|let|var)\s+/,
    ".tsx": /^(export\s+)?(function|class|interface|type|enum|const|let|var)\s+/,
    ".js": /^(export\s+)?(function|class|const|let|var)\s+/,
    ".jsx": /^(export\s+)?(function|class|const|let|var)\s+/,
    ".py": /^(def|class)\s+/,
    ".rs": /^(fn|struct|enum|trait|impl|type|const|static)\s+/,
    ".go": /^(func|type|struct|interface|const|var)\s+/,
    ".java": /^(public\s+|private\s+|protected\s+)?(class|interface|enum|void|int|String|boolean|static\s+)?\s*\w+\s*\(/,
    ".kt": /^(fun|class|interface|object|data\s+class)\s+/,
    ".rb": /^(def|class|module)\s+/,
    ".php": /^(function|class|interface|trait)\s+/,
    ".c": /^(static\s+|extern\s+)?\w+\s+\w+\s*\(/,
    ".cpp": /^(static\s+|extern\s+|inline\s+|virtual\s+)?\w+\s+\w+\s*\(/,
    ".h": /^(static\s+|extern\s+|inline\s+)?\w+\s+\w+\s*\(/,
    ".cs": /^(public\s+|private\s+|protected\s+|internal\s+)?(class|interface|enum|struct|void|string|int|bool|static\s+)?\s*\w+\s*\(/,
    ".swift": /^(func|class|struct|enum|protocol|let|var)\s+/,
  };

  const pattern = defPatterns[ext];
  if (pattern && pattern.test(trimmed)) {
    return "definition";
  }

  return "usage";
}

function extractSymbolName(line: string, matchType: SearchMatch["matchType"]): string | undefined {
  if (matchType === "definition") {
    const m = line.match(/(?:function|class|interface|type|enum|def|fn|struct|trait|impl|func)\s+(\w+)/);
    if (m) return m[1];
    const m2 = line.match(/(?:const|let|var|static)\s+(\w+)/);
    if (m2) return m2[1];
  }
  if (matchType === "import") {
    const m = line.match(/from\s+['"]([^'"]+)['"]/);
    if (m) return m[1];
    const m2 = line.match(/import\s+.*\s+from\s+['"]([^'"]+)['"]/);
    if (m2) return m2[1];
    const m3 = line.match(/require\(['"]([^'"]+)['"]\)/);
    if (m3) return m3[1];
  }
  return undefined;
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

// ─── Cross-Reference Analysis ───────────────────────

export async function analyzeCrossReferences(
  searchPath?: string,
  symbolName?: string,
  maxFiles = 100
): Promise<string> {
  const root = path.resolve(searchPath || process.cwd());
  const definitions: SymbolDefinition[] = [];
  const fileMap = new Map<string, string>();

  async function walk(dir: string) {
    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch { return; }

    for (const name of entries) {
      if (SKIP_DIRS.has(name)) continue;
      const fext = path.extname(name).toLowerCase();
      if (!CODE_EXTENSIONS.has(fext)) continue;

      const full = path.join(dir, name);
      try {
        const stat = await fs.stat(full);
        if (stat.isDirectory()) {
          await walk(full);
        } else if (fileMap.size < maxFiles && stat.size < 200_000) {
          const content = await readFileSafe(full, 200_000);
          fileMap.set(full, content);
        }
      } catch { /* ignore */ }
    }
  }

  await walk(root);

  // Extract definitions
  for (const [filePath, content] of fileMap) {
    const lines = content.split("\n");
    const ext = path.extname(filePath).toLowerCase();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const matchType = detectMatchType(line, ext);
      if (matchType === "definition") {
        const name = extractSymbolName(line, matchType) || extractNameFromDefinition(line, ext);
        if (name && (!symbolName || name.toLowerCase() === symbolName.toLowerCase())) {
          const type = detectSymbolType(line, ext);
          const sig = extractSignature(lines, i, ext);
          definitions.push({
            name,
            file: filePath,
            line: i + 1,
            type,
            signature: sig,
            references: [],
          });
        }
      }
    }
  }

  // Find references
  const defMap = new Map<string, SymbolDefinition[]>();
  for (const def of definitions) {
    const key = `${def.name.toLowerCase()}:${path.extname(def.file)}`;
    if (!defMap.has(key)) defMap.set(key, []);
    defMap.get(key)!.push(def);
  }

  for (const [filePath, content] of fileMap) {
    const lines = content.split("\n");
    const ext = path.extname(filePath).toLowerCase();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const matchType = detectMatchType(line, ext);
      if (matchType !== "definition") {
        for (const [key, defs] of defMap) {
          const [name, defExt] = key.split(":");
          // Only match within same language family or JS/TS cross-match
          const compatible = isCompatibleExtension(ext, defExt);
          if (!compatible) continue;

          const regex = new RegExp(`\\b${escapeRegex(name)}\\b`, "i");
          if (regex.test(line)) {
            const refType: SymbolReference["type"] = matchType === "import" ? "import" : "usage";
            const ref: SymbolReference = {
              file: filePath,
              line: i + 1,
              context: line.trim().slice(0, 120),
              type: refType,
            };
            for (const def of defs) {
              if (def.file !== filePath || def.line !== i + 1) {
                def.references.push(ref);
              }
            }
          }
        }
      }
    }
  }

  // Deduplicate references
  for (const def of definitions) {
    const seen = new Set<string>();
    def.references = def.references.filter((r) => {
      const key = `${r.file}:${r.line}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // Build output
  if (definitions.length === 0) {
    return symbolName
      ? `No definitions found for "${symbolName}" in ${fileMap.size} files scanned.`
      : `No definitions found in ${fileMap.size} files scanned.`;
  }

  const lines: string[] = [
    `# Cross-Reference Analysis (${definitions.length} definitions in ${fileMap.size} files)`,
    "",
  ];

  for (const def of definitions.sort((a, b) => a.name.localeCompare(b.name))) {
    const relFile = path.relative(root, def.file);
    lines.push(`## ${def.name} (${def.type})`);
    lines.push(`Defined: ${relFile}:${def.line}${def.signature ? ` — ${def.signature.slice(0, 80)}` : ""}`);
    if (def.references.length > 0) {
      lines.push(`Referenced ${def.references.length} time(s):`);
      for (const ref of def.references.slice(0, 10)) {
        const refRel = path.relative(root, ref.file);
        lines.push(`  ${refRel}:${ref.line} [${ref.type}] ${ref.context}`);
      }
      if (def.references.length > 10) {
        lines.push(`  ... and ${def.references.length - 10} more`);
      }
    } else {
      lines.push("No references found (unused).");
    }
    lines.push("");
  }

  return lines.join("\n");
}

export async function analyzeFileRelationships(searchPath?: string, maxFiles = 50): Promise<string> {
  const root = path.resolve(searchPath || process.cwd());
  const relationships = new Map<string, FileRelationship>();
  const fileImports = new Map<string, Set<string>>();

  async function walk(dir: string) {
    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch { return; }

    for (const name of entries) {
      if (SKIP_DIRS.has(name)) continue;
      const fext = path.extname(name).toLowerCase();
      if (!CODE_EXTENSIONS.has(fext)) continue;

      const full = path.join(dir, name);
      try {
        const stat = await fs.stat(full);
        if (stat.isDirectory()) {
          await walk(full);
        } else if (fileImports.size < maxFiles && stat.size < 200_000) {
          const content = await readFileSafe(full, 200_000);
          const imports = extractImports(content, fext, full, root);
          fileImports.set(full, imports);
        }
      } catch { /* ignore */ }
    }
  }

  await walk(root);

  // Build relationships
  for (const [filePath, imports] of fileImports) {
    const rel = path.relative(root, filePath);
    const importedBy: string[] = [];
    const relatedFiles: string[] = [];
    const sharedSymbols: string[] = [];

    for (const [otherPath, otherImports] of fileImports) {
      if (otherPath === filePath) continue;
      const otherRel = path.relative(root, otherPath);

      if (otherImports.has(rel)) {
        importedBy.push(otherRel);
      }

      // Check for shared imports
      const shared = [...imports].filter((i) => otherImports.has(i));
      if (shared.length > 0) {
        relatedFiles.push(otherRel);
        sharedSymbols.push(...shared);
      }
    }

    relationships.set(rel, {
      file: rel,
      imports: [...imports],
      importedBy,
      relatedFiles: [...new Set(relatedFiles)],
      sharedSymbols: [...new Set(sharedSymbols)],
    });
  }

  if (relationships.size === 0) {
    return "No file relationships found. Ensure the project has import statements.";
  }

  const lines: string[] = [`# File Relationships (${relationships.size} files analyzed)`, ""];

  for (const [file, rel] of relationships) {
    lines.push(`## ${file}`);
    if (rel.imports.length > 0) {
      lines.push(`Imports (${rel.imports.length}):`);
      for (const imp of rel.imports.slice(0, 8)) {
        lines.push(`  → ${imp}`);
      }
      if (rel.imports.length > 8) lines.push(`  ... and ${rel.imports.length - 8} more`);
    }
    if (rel.importedBy.length > 0) {
      lines.push(`Imported by (${rel.importedBy.length}):`);
      for (const by of rel.importedBy.slice(0, 8)) {
        lines.push(`  ← ${by}`);
      }
      if (rel.importedBy.length > 8) lines.push(`  ... and ${rel.importedBy.length - 8} more`);
    }
    if (rel.relatedFiles.length > 0) {
      lines.push(`Related files (${rel.relatedFiles.length}): ${rel.relatedFiles.slice(0, 5).join(", ")}${rel.relatedFiles.length > 5 ? "..." : ""}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function extractImports(content: string, ext: string, filePath: string, root: string): Set<string> {
  const imports = new Set<string>();
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    let match: RegExpMatchArray | null = null;

    if (ext === ".ts" || ext === ".tsx" || ext === ".js" || ext === ".jsx" || ext === ".mjs") {
      match = trimmed.match(/from\s+['"]([^'"]+)['"]/);
      if (!match) match = trimmed.match(/import\s+['"]([^'"]+)['"]/);
      if (!match) match = trimmed.match(/require\(['"]([^'"]+)['"]\)/);
    } else if (ext === ".py") {
      match = trimmed.match(/from\s+(\S+)\s+import/);
      if (!match) match = trimmed.match(/import\s+(\S+)/);
    } else if (ext === ".rs") {
      match = trimmed.match(/use\s+(\S+);/);
      if (!match) match = trimmed.match(/mod\s+(\S+);/);
    } else if (ext === ".go") {
      match = trimmed.match(/import\s+["']([^"']+)["']/);
    } else if (ext === ".java" || ext === ".kt") {
      match = trimmed.match(/import\s+([^;]+);/);
    }

    if (match) {
      const imp = match[1].trim();
      // Try to resolve relative imports
      if (imp.startsWith(".") && !imp.startsWith("..")) {
        const dir = path.dirname(filePath);
        const resolved = path.relative(root, path.resolve(dir, imp));
        imports.add(resolved.replace(/\\/g, "/"));
      } else if (imp.startsWith("..")) {
        const dir = path.dirname(filePath);
        const resolved = path.relative(root, path.resolve(dir, imp));
        imports.add(resolved.replace(/\\/g, "/"));
      } else {
        imports.add(imp);
      }
    }
  }

  return imports;
}

function extractNameFromDefinition(line: string, ext: string): string | undefined {
  const patterns: RegExp[] = [];
  if ([".ts", ".tsx", ".js", ".jsx", ".mjs"].includes(ext)) {
    patterns.push(/function\s+(\w+)/, /class\s+(\w+)/, /interface\s+(\w+)/, /type\s+(\w+)/, /enum\s+(\w+)/);
    patterns.push(/const\s+(\w+)\s*[:=]/, /let\s+(\w+)\s*[:=]/, /var\s+(\w+)\s*[:=]/);
  } else if (ext === ".py") {
    patterns.push(/def\s+(\w+)/, /class\s+(\w+)/);
  } else if (ext === ".rs") {
    patterns.push(/fn\s+(\w+)/, /struct\s+(\w+)/, /enum\s+(\w+)/, /trait\s+(\w+)/);
  } else if (ext === ".go") {
    patterns.push(/func\s+(?:\([^)]+\)\s+)?(\w+)/);
  } else if (ext === ".java" || ext === ".kt" || ext === ".cs") {
    patterns.push(/(?:public|private|protected|static|final|abstract|inline|override|virtual|const)\s+(?:<[^>]+>\s+)?(?:\w+\s+)*(\w+)\s*\(/);
    patterns.push(/class\s+(\w+)/, /interface\s+(\w+)/);
  }

  for (const p of patterns) {
    const m = line.match(p);
    if (m) return m[1];
  }
  return undefined;
}

function detectSymbolType(line: string, ext: string): SymbolDefinition["type"] {
  const trimmed = line.trim();
  if (/\bfunction\b|\bfn\b|\bfunc\b|\bdef\b/.test(trimmed) && /\(/.test(trimmed)) return "function";
  if (/\bclass\b/.test(trimmed)) return "class";
  if (/\binterface\b/.test(trimmed)) return "interface";
  if (/\btype\b/.test(trimmed) || /\bstruct\b/.test(trimmed) || /\benum\b/.test(trimmed)) return "type";
  if (/\bconst\b|\blet\b|\bvar\b|\bstatic\b/.test(trimmed)) return "variable";
  return "unknown";
}

function extractSignature(lines: string[], startLine: number, ext: string): string | undefined {
  const line = lines[startLine];
  // Try to capture function signature or class declaration on one line
  if (/\(/.test(line)) {
    const sigMatch = line.match(/\w+\s*\([^)]*\)/);
    if (sigMatch) return sigMatch[0];
  }
  // Multi-line function signature
  if ([".ts", ".tsx", ".js", ".jsx", ".rs", ".go", ".java", ".kt", ".cs"].includes(ext)) {
    let sig = line.trim();
    let i = startLine + 1;
    while (i < lines.length && i < startLine + 5) {
      if (lines[i].includes("{")) {
        sig += " " + lines[i].slice(0, lines[i].indexOf("{")).trim();
        break;
      }
      if (lines[i].includes("=>")) {
        sig += " " + lines[i].slice(0, lines[i].indexOf("=>")).trim();
        break;
      }
      sig += " " + lines[i].trim();
      i++;
    }
    return sig.length < 200 ? sig : sig.slice(0, 200) + "...";
  }
  return undefined;
}

function isCompatibleExtension(ext1: string, ext2: string): boolean {
  const jsFamily = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);
  const cFamily = new Set([".c", ".cpp", ".h", ".hpp"]);
  if (jsFamily.has(ext1) && jsFamily.has(ext2)) return true;
  if (cFamily.has(ext1) && cFamily.has(ext2)) return true;
  return ext1 === ext2;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
