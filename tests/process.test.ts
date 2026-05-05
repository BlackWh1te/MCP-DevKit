// BlackWhite — MCP DevKit
import { describe, it, expect } from "vitest";
import {
  listProcesses, killProcess, getProcessTree, monitorProcess,
  filterProcesses, clearProcessHistory, getProcessHistory,
} from "../src/process.js";

const isWindows = process.platform === "win32";

describe("process", () => {
  it.skipIf(isWindows)("lists processes", async () => {
    const result = await listProcesses();
    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty("processes");
    expect(Array.isArray(parsed.processes)).toBe(true);
    expect(parsed.count).toBeGreaterThanOrEqual(0);
  }, 30000);

  it.skipIf(isWindows)("filters processes by name", async () => {
    const result = await filterProcesses({ name: "node" });
    const parsed = JSON.parse(result);
    expect(Array.isArray(parsed.processes)).toBe(true);
  }, 30000);

  it("clears and reports empty process history", () => {
    const result = clearProcessHistory();
    expect(result).toContain("cleared");
  });

  it("returns empty history for unknown pid", () => {
    const result = getProcessHistory("99999999");
    expect(result).toContain("No history");
  });

  it("returns a result for invalid kill target", async () => {
    const result = await killProcess("99999999");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns process tree info", async () => {
    const result = await getProcessTree();
    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty("tree");
  });

  it("monitors a process briefly", async () => {
    // Monitor the current node process
    const result = await monitorProcess(String(process.pid), 100);
    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty("pid");
    expect(parsed).toHaveProperty("samples");
  });
});
