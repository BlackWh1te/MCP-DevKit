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

// ─── Stash ───────────────────────────

export async function gitStash(message?: string, repoPath?: string): Promise<string> {
  const args = message ? ["stash", "push", "-m", message] : ["stash", "push"];
  const out = await runGit(args, repoPath);
  return out || "Changes stashed.";
}

export async function gitStashPop(index = 0, repoPath?: string): Promise<string> {
  const out = await runGit(["stash", "pop", `stash@{${index}}`], repoPath);
  return out || "Stash popped.";
}

export async function gitStashList(repoPath?: string): Promise<string> {
  const out = await runGit(["stash", "list", "--format=%h %gd %s"], repoPath);
  if (!out) return "No stashes found.";
  const lines = out.split("\n").filter(Boolean).map((l) => {
    const parts = l.split(" ");
    return { hash: parts[0], ref: parts[1], message: parts.slice(2).join(" ") };
  });
  return JSON.stringify({ count: lines.length, stashes: lines }, null, 2);
}

// ─── Unstage / Restore ───────────────

export async function gitUnstage(files: string | string[], repoPath?: string): Promise<string> {
  const fileList = Array.isArray(files) ? files : [files];
  const out = await runGit(["restore", "--staged", ...fileList], repoPath);
  return out || `Unstaged ${fileList.length} file(s).`;
}

export async function gitRestore(files: string | string[], repoPath?: string): Promise<string> {
  const fileList = Array.isArray(files) ? files : [files];
  const out = await runGit(["restore", ...fileList], repoPath);
  return out || `Restored ${fileList.length} file(s) to HEAD.`;
}

// ─── Push / Pull / Remote ────────────

export async function gitPush(remote?: string, branch?: string, force = false, repoPath?: string): Promise<string> {
  const args = ["push"];
  if (force) args.push("--force-with-lease");
  if (remote) args.push(remote);
  if (branch) args.push(branch);
  const out = await runGit(args, repoPath);
  return out || "Pushed successfully.";
}

export async function gitPull(remote?: string, branch?: string, repoPath?: string): Promise<string> {
  const args = ["pull"];
  if (remote) args.push(remote);
  if (branch) args.push(branch);
  const out = await runGit(args, repoPath);
  return out || "Pulled successfully.";
}

export async function gitRemote(repoPath?: string): Promise<string> {
  const out = await runGit(["remote", "-v"], repoPath);
  if (!out) return "No remotes configured.";
  const remotes: Record<string, { fetch: string; push: string }> = {};
  for (const line of out.split("\n").filter(Boolean)) {
    const match = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/);
    if (match) {
      const [, name, url, type] = match;
      if (!remotes[name]) remotes[name] = { fetch: "", push: "" };
      remotes[name][type as "fetch" | "push"] = url;
    }
  }
  return JSON.stringify(remotes, null, 2);
}

// ─── Merge / Rebase ──────────────────

export async function gitMerge(branch: string, noFastForward = false, repoPath?: string): Promise<string> {
  const args = noFastForward ? ["merge", "--no-ff", branch] : ["merge", branch];
  const out = await runGit(args, repoPath);
  return out || `Merged '${branch}'.`;
}

export async function gitRebase(branch: string, repoPath?: string): Promise<string> {
  const out = await runGit(["rebase", branch], repoPath);
  return out || `Rebased onto '${branch}'.`;
}

// ─── Tags ────────────────────────────

export async function gitTags(repoPath?: string): Promise<string> {
  const out = await runGit(["tag", "-l", "--format=%(refname:short) %(objectname:short) %(taggerdate:short) %(subject)"], repoPath);
  if (!out) return "No tags found.";
  const lines = out.split("\n").filter(Boolean).map((l) => {
    const parts = l.split(" ");
    return { name: parts[0], hash: parts[1], date: parts[2], message: parts.slice(3).join(" ") };
  });
  return JSON.stringify({ count: lines.length, tags: lines }, null, 2);
}

export async function gitCreateTag(name: string, message?: string, repoPath?: string): Promise<string> {
  const args = message ? ["tag", "-a", name, "-m", message] : ["tag", name];
  const out = await runGit(args, repoPath);
  return out || `Created tag '${name}'.`;
}

// ─── Blame / Show ────────────────────

export async function gitBlame(filePath: string, startLine?: number, endLine?: number, repoPath?: string): Promise<string> {
  const args = ["blame", "-e"];
  if (startLine && endLine) args.push(`-L${startLine},${endLine}`);
  args.push(filePath);
  const out = await runGit(args, repoPath);
  if (!out) return `No blame data for ${filePath}.`;
  const lines = out.split("\n").map((l) => {
    const match = l.match(/^([a-f0-9]+)\s+.*?\((.+?)\s+.*?\)\s+(.*)$/);
    if (match) {
      return { commit: match[1].slice(0, 8), author: match[2].trim(), line: match[3] };
    }
    return l;
  });
  return JSON.stringify({ file: filePath, lines: lines.slice(0, 100) }, null, 2);
}

export async function gitShow(commit: string, repoPath?: string): Promise<string> {
  const out = await runGit(["show", "--stat", "--oneline", commit], repoPath);
  if (!out) return `Commit ${commit} not found.`;
  const stats = out.split("\n").filter((l) => l.includes("|"));
  const summary = out.split("\n")[0] || "";
  return JSON.stringify(
    {
      commit: summary.split(" ")[0],
      message: summary.split(" ").slice(1).join(" "),
      stats,
    },
    null,
    2
  );
}
