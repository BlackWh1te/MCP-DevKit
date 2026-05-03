// BlackWhite — MCP DevKit
import { describe, it, expect } from "vitest";
import { getFileInfo, directoryTree } from "../src/web.js";

describe("web", () => {
  it("gets file info for README", async () => {
    const result = await getFileInfo("README.md");
    const parsed = JSON.parse(result);
    expect(parsed.name).toBe("README.md");
    expect(parsed.type).toBe("file");
    expect(parsed.size).toBeGreaterThan(0);
    expect(parsed.modified).toBeTruthy();
  });

  it("gets directory tree", async () => {
    const result = await directoryTree("src", 2);
    expect(result).toContain("src/");
    expect(result).toContain("├──");
    expect(result).toContain("index.ts");
  });
});
