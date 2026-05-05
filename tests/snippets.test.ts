import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import {
  saveSnippet,
  findSnippet,
  getSnippet,
  listSnippets,
  deleteSnippet,
  updateSnippet,
  exportSnippets,
  importSnippets,
} from "../src/snippets.js";

const SNIPPETS_FILE = path.join(os.homedir(), ".mcp-devkit", "snippets.json");

async function resetSnippets() {
  try {
    await fs.unlink(SNIPPETS_FILE);
  } catch {
    // ignore
  }
}

describe("Snippets", () => {
  beforeEach(resetSnippets);
  afterEach(resetSnippets);

  it("saves a snippet with auto-detected language", async () => {
    const result = await saveSnippet("Hello world function", "function hello() { return 'world'; }");
    expect(result).toContain("Saved snippet");
    expect(result).toContain("javascript");
  });

  it("saves a snippet with explicit language", async () => {
    const result = await saveSnippet("Rust main", "fn main() {}", "rust");
    expect(result).toContain("rust");
  });

  it("finds snippets by query", async () => {
    await saveSnippet("React hook", "useState(0)", "typescript");
    await saveSnippet("Another snippet", "const x = 1", "javascript");

    const result = await findSnippet("react");
    expect(result).toContain("React hook");
    expect(result).toContain("useState");
  });

  it("finds snippets filtered by language", async () => {
    await saveSnippet("Python func", "def hello(): pass", "python");
    await saveSnippet("JS func", "function hello() {}", "javascript");

    const result = await findSnippet("func", "python");
    expect(result).toContain("Python func");
    expect(result).not.toContain("JS func");
  });

  it("returns not found when query has no matches", async () => {
    const result = await findSnippet("nonexistentquery123");
    expect(result).toContain("No snippets found");
  });

  it("gets a snippet by id", async () => {
    await saveSnippet("Get test", "console.log('test')", "javascript");
    const list = await listSnippets();
    const idMatch = list.match(/#([a-z0-9]+)/);
    const id = idMatch ? idMatch[1] : "";

    const result = await getSnippet(id);
    expect(result).toContain("Get test");
    expect(result).toContain("console.log");
  });

  it("lists snippets with filter", async () => {
    await saveSnippet("Tag test", "code", "typescript", ["helper"]);
    const result = await listSnippets(undefined, "helper");
    expect(result).toContain("Tag test");
  });

  it("deletes a snippet", async () => {
    await saveSnippet("Delete me", "x", "text");
    const list = await listSnippets();
    const idMatch = list.match(/#([a-z0-9]+)/);
    const id = idMatch ? idMatch[1] : "";

    const result = await deleteSnippet(id);
    expect(result).toContain("Deleted");

    const after = await listSnippets();
    expect(after).toContain("No snippets stored");
  });

  it("updates a snippet", async () => {
    await saveSnippet("Old name", "old code", "text");
    const list = await listSnippets();
    const idMatch = list.match(/#([a-z0-9]+)/);
    const id = idMatch ? idMatch[1] : "";

    const result = await updateSnippet(id, { name: "New name", code: "new code" });
    expect(result).toContain("Updated");

    const getResult = await getSnippet(id);
    expect(getResult).toContain("New name");
    expect(getResult).toContain("new code");
  });

  it("exports and imports snippets", async () => {
    await saveSnippet("Export test", "code", "text");
    const exportPath = path.join(os.tmpdir(), "snippets-export-test.json");

    const exportResult = await exportSnippets(exportPath);
    expect(exportResult).toContain("Exported");

    await resetSnippets();

    const importResult = await importSnippets(exportPath);
    expect(importResult).toContain("Imported");

    const list = await listSnippets();
    expect(list).toContain("Export test");

    await fs.unlink(exportPath).catch(() => {});
  });
});
