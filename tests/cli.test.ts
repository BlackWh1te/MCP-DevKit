// BlackWhite — MCP DevKit
import { describe, it, expect } from "vitest";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.join(__dirname, "..", "dist", "cli.js");

function runCli(args: string[], timeout = 10000): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [CLI_PATH, ...args], {
      cwd: path.join(__dirname, ".."),
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => { stdout += d.toString(); });
    child.stderr?.on("data", (d) => { stderr += d.toString(); });
    child.on("close", (code) => resolve({ stdout, stderr, code }));
    child.on("error", (err) => reject(err));

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("CLI test timed out"));
    }, timeout);
    child.on("close", () => clearTimeout(timer));
  });
}

describe("cli", () => {
  it("shows help by default", async () => {
    const { stdout, code } = await runCli([]);
    expect(code).toBe(0);
    expect(stdout).toContain("Usage:");
    expect(stdout).toContain("scan");
    expect(stdout).toContain("search");
  }, 15000);

  it("shows help explicitly", async () => {
    const { stdout, code } = await runCli(["help"]);
    expect(code).toBe(0);
    expect(stdout).toContain("Usage:");
  }, 15000);

  it("scans current project", async () => {
    const { stdout, code } = await runCli(["scan", "."]);
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed).toHaveProperty("languages");
    expect(parsed).toHaveProperty("frameworks");
    expect(Array.isArray(parsed.languages)).toBe(true);
  }, 15000);

  it("prints project summary", async () => {
    const { stdout, code } = await runCli(["summary", "."]);
    expect(code).toBe(0);
    expect(stdout).toContain("Project Summary");
    expect(stdout).toContain("MCP");
  }, 15000);

  it("searches code", async () => {
    const { stdout, code } = await runCli(["search", "scanProject"]);
    expect(code).toBe(0);
    expect(stdout.length).toBeGreaterThan(0);
  }, 15000);

  it("reads a file", async () => {
    const { stdout, code } = await runCli(["read", "package.json"]);
    expect(code).toBe(0);
    expect(stdout).toContain("mcp-devkit");
  }, 15000);

  it("errors on missing search query", async () => {
    const { stderr, code } = await runCli(["search"]);
    expect(code).toBe(1);
    expect(stderr).toContain("Usage");
  }, 15000);

  it("errors on missing read file", async () => {
    const { stderr, code } = await runCli(["read"]);
    expect(code).toBe(1);
    expect(stderr).toContain("Usage");
  }, 15000);
});
