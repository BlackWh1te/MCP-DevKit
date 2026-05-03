// BlackWhite — MCP DevKit
import { promises as fs } from "fs";
import path from "path";
import { runCommand } from "./terminal.js";

interface PackageScripts {
  packageManager: string | null;
  scripts: Record<string, string>;
}

export async function getPackageScripts(projectPath?: string): Promise<string> {
  const root = path.resolve(projectPath || process.cwd());

  // Try package.json (Node)
  const pkgPath = path.join(root, "package.json");
  try {
    const pkg = JSON.parse(await fs.readFile(pkgPath, "utf-8"));
    if (pkg.scripts && Object.keys(pkg.scripts).length > 0) {
      const result: PackageScripts = {
        packageManager: await detectNodePM(root),
        scripts: pkg.scripts,
      };
      return JSON.stringify(result, null, 2);
    }
  } catch {
    // ignore
  }

  // Try pyproject.toml (Python)
  const pyprojectPath = path.join(root, "pyproject.toml");
  try {
    const content = await fs.readFile(pyprojectPath, "utf-8");
    const scripts: Record<string, string> = {};
    const scriptSection = content.match(/\[project\.scripts\]([\s\S]*?)(?=\n\[|$)/);
    if (scriptSection) {
      for (const line of scriptSection[1].split("\n")) {
        const match = line.match(/^\s*(\w+)\s*=\s*"(.+)"\s*$/);
        if (match) scripts[match[1]] = match[2];
      }
    }
    if (Object.keys(scripts).length > 0) {
      return JSON.stringify({ packageManager: "poetry/hatch", scripts }, null, 2);
    }
  } catch {
    // ignore
  }

  // Try Makefile
  const makefilePath = path.join(root, "Makefile");
  try {
    const content = await fs.readFile(makefilePath, "utf-8");
    const scripts: Record<string, string> = {};
    const targets = content.matchAll(/^(\w+):/gm);
    for (const match of targets) {
      scripts[match[1]] = `make ${match[1]}`;
    }
    if (Object.keys(scripts).length > 0) {
      return JSON.stringify({ packageManager: "make", scripts }, null, 2);
    }
  } catch {
    // ignore
  }

  // Try Cargo.toml (Rust)
  const cargoPath = path.join(root, "Cargo.toml");
  try {
    const cargo = await fs.readFile(cargoPath, "utf-8");
    const scripts: Record<string, string> = {
      build: "cargo build",
      test: "cargo test",
      run: "cargo run",
      check: "cargo check",
      clippy: "cargo clippy",
    };
    return JSON.stringify({ packageManager: "cargo", scripts }, null, 2);
  } catch {
    // ignore
  }

  return "No package scripts found. Not a Node.js, Python, Rust, or Makefile project.";
}

export async function runPackageScript(script: string, projectPath?: string): Promise<string> {
  const root = path.resolve(projectPath || process.cwd());

  // Check package.json first
  const pkgPath = path.join(root, "package.json");
  try {
    await fs.access(pkgPath);
    const pm = detectNodePM(root);
    return runCommand(`${pm} run ${script}`, root);
  } catch {
    // ignore
  }

  // Check Makefile
  const makefilePath = path.join(root, "Makefile");
  try {
    await fs.access(makefilePath);
    return runCommand(`make ${script}`, root);
  } catch {
    // ignore
  }

  // Check Cargo.toml
  const cargoPath = path.join(root, "Cargo.toml");
  try {
    await fs.access(cargoPath);
    return runCommand(`cargo ${script}`, root);
  } catch {
    // ignore
  }

  return `Could not determine how to run '${script}' in ${root}`;
}

async function detectNodePM(root: string): Promise<string> {
  const lockFiles: Record<string, string> = {
    "bun.lockb": "bun",
    "bun.lock": "bun",
    "pnpm-lock.yaml": "pnpm",
    "yarn.lock": "yarn",
    "package-lock.json": "npm",
  };
  for (const [file, pm] of Object.entries(lockFiles)) {
    try {
      await fs.access(path.join(root, file));
      return pm;
    } catch {
      // try next
    }
  }
  return "npm";
}
