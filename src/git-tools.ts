// BlackWhite — MCP DevKit
import { spawn } from "child_process";

function runGit(args: string[], cwd?: string, timeout = 15000): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn("git", args, {
      cwd: cwd || process.cwd(),
      env: { ...process.env },
    });
    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
    }, timeout);

    child.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString("utf-8");
    });

    child.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString("utf-8");
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve(`Git error: ${err.message}`);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0 && stderr) {
        resolve(stderr.trim());
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

export async function gitStatus(repoPath?: string): Promise<string> {
  const out = await runGit(["status", "--short", "--branch"], repoPath);
  if (!out) return "Working tree clean.";
  return out;
}

export async function gitLog(repoPath?: string, count = 10): Promise<string> {
  const out = await runGit(
    ["log", `--max-count=${count}`, "--oneline", "--decorate"],
    repoPath
  );
  return out || "No commits found.";
}

export async function gitDiff(repoPath?: string, target?: string): Promise<string> {
  const args = target ? ["diff", target] : ["diff"];
  const out = await runGit(args, repoPath);
  if (!out) return "No changes.";
  // Truncate huge diffs
  return out.length > 50000 ? out.slice(0, 50000) + "\n... (truncated)" : out;
}

export async function gitAdd(files: string | string[], repoPath?: string): Promise<string> {
  const fileList = Array.isArray(files) ? files : [files];
  const out = await runGit(["add", ...fileList], repoPath);
  return out || `Staged ${fileList.length} file(s).`;
}

export async function gitCommit(message: string, repoPath?: string): Promise<string> {
  const out = await runGit(["commit", "-m", message], repoPath);
  return out || "Committed successfully.";
}

export async function gitBranches(repoPath?: string): Promise<string> {
  const out = await runGit(
    ["branch", "-a", "--format=%(refname:short) %(upstream:short) %(HEAD)"],
    repoPath
  );
  if (!out) return "No branches found.";

  const lines = out.split("\n").filter(Boolean);
  const result = {
    current: lines.find((l) => l.includes("*"))?.replace("*", "").trim().split(" ")[0] || "?",
    branches: lines.map((l) => {
      const isCurrent = l.includes("*");
      const clean = l.replace("*", "").trim();
      const parts = clean.split(" ");
      return {
        name: parts[0],
        upstream: parts[1] || null,
        current: isCurrent,
      };
    }),
  };
  return JSON.stringify(result, null, 2);
}

export async function gitCheckout(branch: string, create = false, repoPath?: string): Promise<string> {
  const args = create ? ["checkout", "-b", branch] : ["checkout", branch];
  const out = await runGit(args, repoPath);
  return out || `Switched to ${create ? "new" : ""} branch '${branch}'.`;
}
