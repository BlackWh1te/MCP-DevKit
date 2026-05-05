// BlackWhite — MCP DevKit
import { describe, it, expect } from "vitest";
import { generateCommitMessage } from "../src/ai-commit.js";

describe("ai-commit", () => {
  it("generates a commit message or reports no changes", async () => {
    const result = await generateCommitMessage();
    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty("suggestion");
    expect(parsed).toHaveProperty("conventionalCommit");
    expect(parsed).toHaveProperty("stats");
    // Either we have changes (conventionalCommit=true) or not (conventionalCommit=false)
    if (parsed.conventionalCommit) {
      expect(parsed.type).toBeTruthy();
      expect(parsed.suggestion).toContain(":");
    } else {
      expect(parsed.error).toBeTruthy();
      expect(parsed.stats.files).toBe(0);
    }
  });
});
