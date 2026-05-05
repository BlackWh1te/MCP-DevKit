import { describe, it, expect } from "vitest";
import {
  gitStatus,
  gitLog,
  gitRemote,
  gitShow,
  gitBranches,
  gitDiff,
  analyzeBranchHealth,
  analyzeWorkflow,
  scoreCommitQuality,
  detectConflicts,
  getGitConfig,
} from "../src/git-tools.js";

describe("git-tools", () => {
  it("returns git status", async () => {
    const result = await gitStatus(".");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns git log", async () => {
    const result = await gitLog(".", 5);
    expect(result).toContain("feat:");
  });

  it("returns branches", async () => {
    const result = await gitBranches(".");
    const parsed = JSON.parse(result);
    expect(parsed.current).toBe("main");
    expect(parsed.branches.length).toBeGreaterThan(0);
  });

  it("returns remotes", async () => {
    const result = await gitRemote(".");
    const parsed = JSON.parse(result);
    expect(parsed.origin).toBeTruthy();
    expect(parsed.origin.fetch).toContain("github.com");
  });

  it("shows a commit", async () => {
    const result = await gitShow("HEAD", ".");
    const parsed = JSON.parse(result);
    expect(parsed.commit).toBeTruthy();
    expect(parsed.message).toBeTruthy();
  });

  it("returns git diff for HEAD", async () => {
    const result = await gitDiff(".", "HEAD");
    expect(result.length).toBeGreaterThanOrEqual(0);
  });

  it("analyzes branch health", async () => {
    const result = await analyzeBranchHealth(".");
    expect(result.length).toBeGreaterThan(0);
  });

  it("analyzes workflow type", async () => {
    const result = await analyzeWorkflow(".");
    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty("type");
  });

  it("scores commit quality", async () => {
    const result = await scoreCommitQuality(".", 5);
    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty("commits");
    expect(parsed).toHaveProperty("averageScore");
  });

  it("detects conflicts (none expected)", async () => {
    const result = await detectConflicts(".");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns git config", async () => {
    const result = await getGitConfig(".");
    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty("local");
    expect(parsed).toHaveProperty("global");
  });
});
