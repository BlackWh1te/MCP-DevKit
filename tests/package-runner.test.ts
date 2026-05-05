// BlackWhite — MCP DevKit
import { describe, it, expect } from "vitest";
import {
  getPackageScripts,
  getDependencies,
  getPackageInfo,
  clearPackageCache,
  getPackageCacheStats,
} from "../src/package-runner.js";

describe("package-runner", () => {
  it("clears cache and reports empty stats", () => {
    const clearResult = clearPackageCache();
    expect(clearResult).toContain("cleared");
    const stats = JSON.parse(getPackageCacheStats());
    expect(stats.scriptCacheSize).toBe(0);
    expect(stats.dependencyCacheSize).toBe(0);
  });

  it("gets package scripts for current project", async () => {
    clearPackageCache();
    const result = await getPackageScripts(".");
    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty("scripts");
    expect(parsed.scripts).toHaveProperty("build");
    expect(parsed.scripts).toHaveProperty("test");
  });

  it("caches package scripts", async () => {
    clearPackageCache();
    const first = await getPackageScripts(".");
    const second = await getPackageScripts(".");
    expect(first).toBe(second);
    const stats = JSON.parse(getPackageCacheStats());
    expect(stats.scriptCacheSize).toBe(1);
  });

  it("gets dependencies for current project", async () => {
    clearPackageCache();
    const result = await getDependencies(".");
    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty("dependencies");
    expect(parsed).toHaveProperty("devDependencies");
    expect(parsed).toHaveProperty("total");
    expect(parsed.total).toBeGreaterThanOrEqual(0);
  });

  it("caches dependencies", async () => {
    clearPackageCache();
    const first = await getDependencies(".");
    const second = await getDependencies(".");
    expect(first).toBe(second);
    const stats = JSON.parse(getPackageCacheStats());
    expect(stats.dependencyCacheSize).toBe(1);
  });

  it("gets package info for current project", async () => {
    const result = await getPackageInfo(".");
    const parsed = JSON.parse(result);
    expect(parsed.name).toBe("mcp-devkit");
    expect(parsed).toHaveProperty("version");
    expect(parsed).toHaveProperty("description");
  });

  it("returns no scripts for non-project directory", async () => {
    const result = await getPackageScripts("/tmp/nonexistent-dir-12345");
    expect(result).toContain("No package scripts found");
  });

  it("returns no dependencies for non-project directory", async () => {
    const result = await getDependencies("/tmp/nonexistent-dir-12345");
    expect(result).toContain("No dependencies found");
  });

  it("returns no info for non-project directory", async () => {
    const result = await getPackageInfo("/tmp/nonexistent-dir-12345");
    expect(result).toContain("No package info found");
  });
});
