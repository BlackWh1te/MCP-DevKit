// BlackWhite — MCP DevKit
import { describe, it, expect } from "vitest";
import { getSystemInfo, checkPort } from "../src/system.js";

describe("system", () => {
  it("returns system info", () => {
    const info = JSON.parse(getSystemInfo());
    expect(info.platform).toBeTruthy();
    expect(info.nodeVersion).toBeTruthy();
    expect(info.cpus).toBeGreaterThan(0);
    expect(info.totalMemory).toBeTruthy();
  });

  it("checks port availability", async () => {
    const result = await checkPort(54321);
    const parsed = JSON.parse(result);
    expect(parsed.available).toBe(true);
    expect(parsed.port).toBe(54321);
  });
});
