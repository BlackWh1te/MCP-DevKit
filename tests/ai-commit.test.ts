import { describe, it, expect } from "vitest";
import { generateCommitMessage, validateCommit } from "../src/ai-commit.js";

describe("ai-commit", () => {
  it("generates a commit message or reports no changes", async () => {
    const result = await generateCommitMessage();
    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty("suggestion");
    expect(parsed).toHaveProperty("conventionalCommit");
    expect(parsed).toHaveProperty("stats");
    if (parsed.conventionalCommit) {
      expect(parsed.type).toBeTruthy();
      expect(parsed.suggestion).toContain(":");
    } else {
      expect(parsed.error).toBeTruthy();
      expect(parsed.stats.files).toBe(0);
    }
  });

  it("returns valid JSON when no changes detected", async () => {
    const result = await generateCommitMessage();
    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty("conventionalCommit");
    expect(parsed).toHaveProperty("suggestion");
    expect(parsed).toHaveProperty("stats");
    expect(typeof parsed.conventionalCommit).toBe("boolean");
  });

  it("validates a commit message", async () => {
    const result = await validateCommit(".", "feat: add new feature");
    expect(result.length).toBeGreaterThan(0);
  });

  it("validates commit with missing type prefix", async () => {
    const result = await validateCommit(".", "just a plain message");
    const parsed = JSON.parse(result);
    expect(parsed.valid).toBe(false);
    expect(parsed.errors.length).toBeGreaterThan(0);
  });

  it("validates commit with empty message", async () => {
    const result = await validateCommit(".", "");
    expect(result.length).toBeGreaterThan(0);
  });
});
