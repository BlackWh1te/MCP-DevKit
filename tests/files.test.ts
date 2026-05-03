// BlackWhite — MCP DevKit
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFile, writeFile, editFile, deleteFile, listDirectory } from "../src/files.js";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

const tmpDir = path.join(os.tmpdir(), "mcp-devkit-test-files");
const testFile = path.join(tmpDir, "test.txt");

describe("files", () => {
  beforeAll(async () => {
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterAll(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("writes and reads a file", async () => {
    const writeResult = await writeFile(testFile, "Hello, DevKit!");
    expect(writeResult).toContain("Wrote");

    const content = await readFile(testFile);
    expect(content).toBe("Hello, DevKit!");
  });

  it("edits a file", async () => {
    await writeFile(testFile, "old content");
    const editResult = await editFile(testFile, "old content", "new content");
    expect(editResult).toContain("Edited");

    const content = await readFile(testFile);
    expect(content).toBe("new content");
  });

  it("fails to edit non-unique string", async () => {
    await writeFile(testFile, "a b a c");
    const result = await editFile(testFile, "a", "x");
    expect(result).toContain("appears 2 times");
  });

  it("lists directory contents", async () => {
    const dir = path.join(tmpDir, "list-test");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "file1.txt"), "a", "utf-8");
    await fs.mkdir(path.join(dir, "subdir"), { recursive: true });

    const listing = await listDirectory(dir, 1);
    expect(listing).toContain("file1.txt");
    expect(listing).toContain("subdir");
  });

  it("deletes a file", async () => {
    const delFile = path.join(tmpDir, "to-delete.txt");
    await writeFile(delFile, "bye");
    const result = await deleteFile(delFile);
    expect(result).toContain("Deleted");
  });
});
