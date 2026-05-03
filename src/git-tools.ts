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
