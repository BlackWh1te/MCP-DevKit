// BlackWhite — MCP DevKit
import { promises as fs } from "fs";
import path from "path";
import { runCommand } from "./terminal.js";

interface PackageScripts {
  packageManager: string | null;
  scripts: Record<string, string>;
}

interface CacheEntry {
  data: string;
  timestamp: number;
}

const scriptCache = new Map<string, CacheEntry>();
const dependencyCache = new Map<string, CacheEntry>();

function getCacheKey(type: string, key: string): string {
  return `${type}:${key}`;
}

function getCached(key: string, ttl: number): string | null {
  const entry = scriptCache.get(key) || dependencyCache.get(key);
  if (!entry) return null;
  
  const age = Date.now() - entry.timestamp;
  if (age > ttl) {
    scriptCache.delete(key);
    dependencyCache.delete(key);
    return null;
  }
  
  return entry.data;
}

function setCache(type: "scripts" | "dependencies", key: string, data: string): void {
  const cache = type === "scripts" ? scriptCache : dependencyCache;
  cache.set(key, { data, timestamp: Date.now() });
  
  // Limit cache size
  if (cache.size > 50) {
    const oldestKey = Array.from(cache.keys())[0];
    cache.delete(oldestKey);
  }
}

function clearCache(type?: "scripts" | "dependencies"): void {
  if (!type || type === "scripts") scriptCache.clear();
  if (!type || type === "dependencies") dependencyCache.clear();
}

export async function getPackageScripts(projectPath?: string): Promise<string> {
  const root = path.resolve(projectPath || process.cwd());
  const cacheKey = getCacheKey("scripts", root);
  
  // Check cache (5 minute TTL for scripts)
  const cached = getCached(cacheKey, 300000);
  if (cached) return cached;

  // Try package.json (Node)
  const pkgPath = path.join(root, "package.json");
  try {
    const pkg = JSON.parse(await fs.readFile(pkgPath, "utf-8"));
    if (pkg.scripts && Object.keys(pkg.scripts).length > 0) {
      const result: PackageScripts = {
        packageManager: await detectNodePM(root),
        scripts: pkg.scripts,
      };
      const resultStr = JSON.stringify(result, null, 2);
      setCache("scripts", cacheKey, resultStr);
      return resultStr;
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
      const resultStr = JSON.stringify({ packageManager: "poetry/hatch", scripts }, null, 2);
      setCache("scripts", cacheKey, resultStr);
      return resultStr;
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
      const resultStr = JSON.stringify({ packageManager: "make", scripts }, null, 2);
      setCache("scripts", cacheKey, resultStr);
      return resultStr;
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
    const resultStr = JSON.stringify({ packageManager: "cargo", scripts }, null, 2);
    setCache("scripts", cacheKey, resultStr);
    return resultStr;
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

export async function getDependencies(projectPath?: string): Promise<string> {
  const root = path.resolve(projectPath || process.cwd());
  const cacheKey = getCacheKey("dependencies", root);
  
  // Check cache (10 minute TTL for dependencies)
  const cached = getCached(cacheKey, 600000);
  if (cached) return cached;
  
  // Try package.json (Node)
  const pkgPath = path.join(root, "package.json");
  try {
    const pkg = JSON.parse(await fs.readFile(pkgPath, "utf-8"));
    const deps = {
      dependencies: pkg.dependencies || {},
      devDependencies: pkg.devDependencies || {},
      peerDependencies: pkg.peerDependencies || {},
      total: Object.keys(pkg.dependencies || {}).length + Object.keys(pkg.devDependencies || {}).length,
    };
    const resultStr = JSON.stringify(deps, null, 2);
    setCache("dependencies", cacheKey, resultStr);
    return resultStr;
  } catch {
    // ignore
  }
  
  // Try Cargo.toml (Rust)
  const cargoPath = path.join(root, "Cargo.toml");
  try {
    const cargo = await fs.readFile(cargoPath, "utf-8");
    const deps: Record<string, string> = {};
    const depMatch = cargo.match(/\[dependencies\]([\s\S]*?)(?=\n\[|$)/);
    if (depMatch) {
      for (const line of depMatch[1].split("\n")) {
        const match = line.match(/^\s*(\w+)\s*=\s*(?:"(.+)"|{.*version\s*=\s*"(.+)".*})/);
        if (match) {
          deps[match[1]] = match[2] || match[3] || "latest";
        }
      }
    }
    const resultStr = JSON.stringify({ dependencies: deps, total: Object.keys(deps).length }, null, 2);
    setCache("dependencies", cacheKey, resultStr);
    return resultStr;
  } catch {
    // ignore
  }
  
  // Try pyproject.toml (Python)
  const pyprojectPath = path.join(root, "pyproject.toml");
  try {
    const content = await fs.readFile(pyprojectPath, "utf-8");
    const deps: Record<string, string> = {};
    const depMatch = content.match(/\[project\](?:[\s\S]*?)dependencies\s*=\s*\[(.*?)\]/);
    if (depMatch) {
      const depList = depMatch[1].replace(/"/g, "").split(",").map(d => d.trim());
      for (const dep of depList) {
        if (dep) deps[dep] = "*";
      }
    }
    const resultStr = JSON.stringify({ dependencies: deps, total: Object.keys(deps).length }, null, 2);
    setCache("dependencies", cacheKey, resultStr);
    return resultStr;
  } catch {
    // ignore
  }
  
  return "No dependencies found. Not a Node.js, Python, or Rust project.";
}

export function clearPackageCache(): string {
  clearCache();
  return "Package cache cleared.";
}

export function getPackageCacheStats(): string {
  return JSON.stringify({
    scriptCacheSize: scriptCache.size,
    dependencyCacheSize: dependencyCache.size,
    totalEntries: scriptCache.size + dependencyCache.size,
  }, null, 2);
}

export async function getPackageInfo(projectPath?: string): Promise<string> {
  const root = path.resolve(projectPath || process.cwd());
  
  // Try package.json (Node)
  const pkgPath = path.join(root, "package.json");
  try {
    const pkg = JSON.parse(await fs.readFile(pkgPath, "utf-8"));
    const info = {
      name: pkg.name,
      version: pkg.version,
      description: pkg.description,
      main: pkg.main,
      author: pkg.author,
      license: pkg.license,
      repository: pkg.repository,
      homepage: pkg.homepage,
      packageManager: await detectNodePM(root),
      scriptCount: Object.keys(pkg.scripts || {}).length,
      dependencyCount: Object.keys(pkg.dependencies || {}).length,
      devDependencyCount: Object.keys(pkg.devDependencies || {}).length,
    };
    return JSON.stringify(info, null, 2);
  } catch {
    // ignore
  }
  
  // Try Cargo.toml (Rust)
  const cargoPath = path.join(root, "Cargo.toml");
  try {
    const cargo = await fs.readFile(cargoPath, "utf-8");
    const nameMatch = cargo.match(/^name\s*=\s*"(.+)"$/m);
    const versionMatch = cargo.match(/^version\s*=\s*"(.+)"$/m);
    const descMatch = cargo.match(/^description\s*=\s*"(.+)"$/m);
    
    return JSON.stringify({
      name: nameMatch?.[1] || "unknown",
      version: versionMatch?.[1] || "unknown",
      description: descMatch?.[1],
      packageManager: "cargo",
      type: "Rust",
    }, null, 2);
  } catch {
    // ignore
  }
  
  return `No package info found for ${root}`;
}
