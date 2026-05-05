// BlackWhite — MCP DevKit
import { describe, it, expect } from "vitest";
import {
  getCodeStats, getStatsTrend, clearStatsHistory,
  getFileSizeDistribution,
} from "../src/stats.js";

describe("stats", () => {
  it("analyzes current project", async () => {
    const result = await getCodeStats(".");
    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty("summary");
    expect(parsed).toHaveProperty("breakdown");
    expect(parsed.summary.totalFiles).toBeGreaterThan(0);
    expect(parsed.summary.totalLines).toBeGreaterThan(0);
  });

  it("returns trend data after multiple snapshots", async () => {
    clearStatsHistory();
    await getCodeStats(".");
    await getCodeStats(".");
    const result = getStatsTrend();
    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty("period");
    expect(parsed).toHaveProperty("changes");
  });

  it("clears stats history", () => {
    const result = clearStatsHistory();
    expect(result).toContain("cleared");
  });

  it("returns file size distribution", async () => {
    const result = await getFileSizeDistribution(".");
    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty("distribution");
    expect(parsed).toHaveProperty("totalFiles");
  });
});
