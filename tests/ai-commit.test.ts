// BlackWhite — MCP DevKit
import { describe, it, expect } from "vitest";
import { generateCommitMessage } from "../src/ai-commit.js";

describe("ai-commit", () => {
  it("generates a commit message for this repo", async () => {
    const result = await generateCommitMessage();
    // Since we have uncommitted changes, it should detect them
    const parsed = JSON.parse(result);
    expect(parsed.conventionalCommit).toBe(true);
    expect(parsed.type).toBeTruthy();
    expect(parsed.suggestion).toContain(":");
    expect(parsed.stats.files).toBeGreaterThan(0);
    expect(parsed.files.length).toBeGreaterThan(0);
  });
});
