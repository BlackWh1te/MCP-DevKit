// BlackWhite — MCP DevKit
import { spawn } from "child_process";

function runGit(args: string[], cwd?: string, timeout = 15000): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn("git", args, { cwd: cwd || process.cwd(), env: { ...process.env } });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGTERM"), timeout);
    child.stdout?.on("data", (d: Buffer) => { stdout += d.toString("utf-8"); });
    child.stderr?.on("data", (d: Buffer) => { stderr += d.toString("utf-8"); });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve(code !== 0 && stderr ? stderr.trim() : stdout.trim());
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve(`Git error: ${err.message}`);
    });
  });
}

interface DiffHunk {
  file: string;
  additions: number;
  deletions: number;
  changes: string[];
}

interface CommitMessage {
  suggestion: string;
  type: string;
  scope: string | null;
  breaking: boolean;
  body: string;
  footer: string;
  stats: {
    files: number;
    additions: number;
    deletions: number;
  };
  files: string[];
  conventionalCommit: boolean;
  issues: string[];
  refs: string[];
}

function parseDiff(diffText: string): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  const lines = diffText.split("\n");
  let current: DiffHunk | null = null;

  for (const line of lines) {
    if (line.startsWith("diff --git")) {
      const match = line.match(/diff --git a\/(.+?) b\//);
      if (match) {
        if (current) hunks.push(current);
        current = { file: match[1], additions: 0, deletions: 0, changes: [] };
      }
    } else if (current) {
      if (line.startsWith("+")) {
        current.additions++;
        const content = line.slice(1).trim();
        if (content.length > 3 && !content.startsWith("//") && !content.startsWith("*") && !content.startsWith("import") && !content.startsWith("using ")) {
          current.changes.push(content);
        }
      } else if (line.startsWith("-")) {
        current.deletions++;
      }
    }
  }
  if (current) hunks.push(current);
  return hunks;
}

function detectBreakingChanges(hunks: DiffHunk[]): boolean {
  const allChanges = hunks.flatMap((h) => h.changes).join(" ").toLowerCase();
  const breakingKeywords = [
    "breaking", "break", "remove", "delete", "deprecate", "major",
    "incompatible", "change api", "change interface", "rename"
  ];
  return breakingKeywords.some(kw => allChanges.includes(kw));
}

function extractIssues(text: string): string[] {
  const issuePattern = /(?:fix|fixes|fixed|close|closes|closed|resolve|resolves|resolved)\s+#?(\d+)/gi;
  const matches = [...text.matchAll(issuePattern)];
  return [...new Set(matches.map(m => m[1]))];
}

function extractRefs(text: string): string[] {
  const refPattern = /(?:ref|refs|references?)\s+#?(\d+)/gi;
  const matches = [...text.matchAll(refPattern)];
  return [...new Set(matches.map(m => m[1]))];
}

function generateFooter(issues: string[], refs: string[]): string {
  const footer: string[] = [];
  if (issues.length > 0) {
    footer.push(`Closes ${issues.map(i => `#${i}`).join(", ")}`);
  }
  if (refs.length > 0) {
    footer.push(`Refs ${refs.map(r => `#${r}`).join(", ")}`);
  }
  return footer.join("\n");
}

function validateCommitMessage(message: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check conventional commits format
  const conventionalPattern = /^(\w+)(\([^)]+\))?: .+/;
  if (!conventionalPattern.test(message)) {
    errors.push("Message must follow conventional commits format: type(scope): description");
  }
  
  // Check type
  const validTypes = ["feat", "fix", "docs", "style", "refactor", "perf", "test", "chore", "revert", "ci", "build"];
  const match = message.match(/^(\w+)/);
  if (match && !validTypes.includes(match[1])) {
    errors.push(`Invalid commit type: ${match[1]}. Valid types: ${validTypes.join(", ")}`);
  }
  
  // Check description length
  const description = message.split(": ")[1]?.split("\n")[0] || "";
  if (description.length === 0) {
    errors.push("Commit description cannot be empty");
  } else if (description.length > 72) {
    errors.push("Commit description should not exceed 72 characters");
  }
  
  // Check for imperative mood
  const imperativeVerbs = ["add", "fix", "remove", "update", "change", "create", "delete", "implement", "refactor"];
  const firstWord = description.split(" ")[0]?.toLowerCase();
  if (firstWord && !imperativeVerbs.includes(firstWord) && !description.startsWith("Update") && !description.startsWith("Add")) {
    errors.push("Commit description should use imperative mood (e.g., 'add feature' not 'added feature')");
  }
  
  return { valid: errors.length === 0, errors };
}

function classifyChange(hunks: DiffHunk[]): string {
  let totalAdd = 0;
  let totalDel = 0;
  const files = hunks.map((h) => h.file.toLowerCase());
  const allChanges = hunks.flatMap((h) => h.changes);
  const changeText = allChanges.join(" ").toLowerCase();

  for (const h of hunks) {
    totalAdd += h.additions;
    totalDel += h.deletions;
  }

  // Check file patterns
  const isTest = files.some((f) =>
    f.includes("test") || f.includes("spec") || f.includes("__tests__") || f.includes("e2e")
  );
  const isDoc = files.some((f) =>
    f.endsWith(".md") || f.includes("readme") || f.includes("changelog") || f.includes("docs/")
  );
  const isConfig = files.some((f) =>
    f.endsWith(".json") || f.endsWith(".yaml") || f.endsWith(".yml") || f.endsWith(".toml") ||
    f.includes("config") || f.includes(".github/") || f.includes("docker")
  );
  const isLockfile = files.some((f) =>
    f.includes("lock") || f.endsWith(".lockb")
  );

  if (isLockfile && files.length === 1) return "chore(deps)";
  if (isDoc && totalAdd > totalDel * 2) return "docs";
  if (isTest && !files.some((f) => !f.includes("test") && !f.includes("spec"))) return "test";
  if (isConfig && totalAdd < 20 && totalDel < 20) return "chore(config)";

  // Check semantic patterns in code changes
  if (changeText.includes("fix") || changeText.includes("bug") || changeText.includes("resolve") || changeText.includes("error")) return "fix";
  if (changeText.includes("refactor") || changeText.includes("extract") || changeText.includes("rename") || changeText.includes("move")) return "refactor";
  if (changeText.includes("remove") || changeText.includes("delete") || changeText.includes("cleanup")) return "chore";
  if (totalDel > totalAdd * 2) return "refactor";
  if (totalAdd > totalDel * 3 && changeText.includes("add")) return "feat";

  // Default based on ratio
  if (isTest) return "test";
  if (totalAdd > totalDel * 2) return "feat";
  if (totalDel > totalAdd) return "refactor";
  return "chore";
}

function generateScope(hunks: DiffHunk[]): string {
  // Extract most common directory or file type
  const dirs = hunks.map((h) => {
    const parts = h.file.split("/");
    return parts.length > 1 ? parts[0] : "";
  }).filter(Boolean);

  if (dirs.length > 0) {
    const counts = new Map<string, number>();
    for (const d of dirs) counts.set(d, (counts.get(d) || 0) + 1);
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    if (sorted[0] && sorted[0][1] >= hunks.length * 0.5) {
      const scope = sorted[0][0];
      if (scope !== ".") return `(${scope})`;
    }
  }

  // Try by extension
  const exts = hunks.map((h) => {
    const ext = h.file.split(".").pop();
    return ext && ext.length <= 5 ? ext : "";
  }).filter(Boolean);
  if (exts.length > 0 && new Set(exts).size === 1) {
    return `(${exts[0]})`;
  }

  return "";
}

function generateSummary(hunks: DiffHunk[], type: string): string {
  const allChanges = hunks.flatMap((h) => h.changes);
  const files = hunks.map((h) => h.file);

  // Try to extract a meaningful summary from code changes
  const keywords = [
    { pattern: /add\w*\s+(\w+)/i, verb: "add" },
    { pattern: /remove\w*\s+(\w+)/i, verb: "remove" },
    { pattern: /update\w*\s+(\w+)/i, verb: "update" },
    { pattern: /implement\w*\s+(\w+)/i, verb: "implement" },
    { pattern: /create\w*\s+(\w+)/i, verb: "create" },
    { pattern: /fix\w*\s+(\w+)/i, verb: "fix" },
    { pattern: /support\w*\s+(\w+)/i, verb: "add support for" },
    { pattern: /enable\w*\s+(\w+)/i, verb: "enable" },
  ];

  for (const kw of keywords) {
    for (const change of allChanges) {
      const match = change.match(kw.pattern);
      if (match) {
        const noun = match[1].replace(/[;:,.]$/, "");
        if (noun.length > 2 && noun.length < 30) {
          return `${kw.verb} ${noun}`;
        }
      }
    }
  }

  // Fallback based on file changes
  const fileCount = files.length;
  const fileNames = files.map((f) => f.split("/").pop() || f);

  if (fileCount === 1) {
    const name = fileNames[0].replace(/\.(ts|js|tsx|jsx|py|rs|go|java|cs|rb|php)$/, "");
    if (type === "feat") return `add ${name}`;
    if (type === "fix") return `fix ${name}`;
    if (type === "refactor") return `refactor ${name}`;
    return `update ${name}`;
  }

  if (type === "test") return `add tests for ${fileNames.slice(0, 2).join(", ")}${fileCount > 2 ? ` and ${fileCount - 2} more` : ""}`;
  if (type === "docs") return `update documentation`;
  if (type.startsWith("chore(deps)")) return `update dependencies`;
  if (type === "chore(config)") return `update configuration`;

  return `update ${fileCount} file${fileCount > 1 ? "s" : ""}`;
}

export async function generateCommitMessage(repoPath?: string): Promise<string> {
  const diff = await runGit(["diff", "--cached"], repoPath);
  if (!diff) {
    // Try unstaged
    const unstaged = await runGit(["diff"], repoPath);
    if (!unstaged) return "No changes detected. Stage files with `git add` first.";
  }

  const effectiveDiff = diff || await runGit(["diff"], repoPath);
  const hunks = parseDiff(effectiveDiff);

  if (hunks.length === 0) {
    return "No meaningful changes detected.";
  }

  const type = classifyChange(hunks);
  const scope = generateScope(hunks);
  const summary = generateSummary(hunks, type);
  const breaking = detectBreakingChanges(hunks);

  const totalAdd = hunks.reduce((s, h) => s + h.additions, 0);
  const totalDel = hunks.reduce((s, h) => s + h.deletions, 0);

  const message = `${type}${scope}${breaking ? "!" : ""}: ${summary}`;

  const allChangesText = hunks.flatMap((h) => h.changes).join(" ");
  const issues = extractIssues(allChangesText);
  const refs = extractRefs(allChangesText);

  const bodyLines: string[] = [];
  bodyLines.push(`Changed ${hunks.length} file(s): +${totalAdd} -${totalDel}`);
  bodyLines.push("");
  bodyLines.push("Files:");
  for (const h of hunks.slice(0, 10)) {
    const indicator = h.additions > 0 && h.deletions > 0 ? "~" : h.additions > 0 ? "+" : "-";
    bodyLines.push(`  ${indicator} ${h.file} (+${h.additions}/-${h.deletions})`);
  }
  if (hunks.length > 10) bodyLines.push(`  ... and ${hunks.length - 10} more`);

  const footer = generateFooter(issues, refs);

  const result: CommitMessage = {
    suggestion: message,
    type,
    scope: scope.replace(/[()]/g, "") || null,
    breaking,
    body: bodyLines.join("\n"),
    footer,
    stats: { files: hunks.length, additions: totalAdd, deletions: totalDel },
    files: hunks.map((h) => h.file),
    conventionalCommit: true,
    issues,
    refs,
  };

  return JSON.stringify(result, null, 2);
}

export async function validateCommit(repoPath?: string, commitMessage?: string): Promise<string> {
  if (!commitMessage) {
    const diff = await runGit(["log", "-1", "--pretty=%B"], repoPath);
    commitMessage = diff;
  }
  
  const validation = validateCommitMessage(commitMessage);
  
  const result = {
    message: commitMessage,
    valid: validation.valid,
    errors: validation.errors,
  };
  
  return JSON.stringify(result, null, 2);
}
