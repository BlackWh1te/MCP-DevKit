import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { batchRead, batchWrite, batchEdit, batchDelete, batchCopy, batchMove } from "../src/batch-files.js";

const TMP = os.tmpdir();

describe("Batch Files", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(TMP, `batch-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it("batch reads multiple files", async () => {
    const f1 = path.join(testDir, "a.txt");
    const f2 = path.join(testDir, "b.txt");
    await fs.writeFile(f1, "hello", "utf-8");
    await fs.writeFile(f2, "world", "utf-8");

    const result = await batchRead([f1, f2]);
    expect(result).toContain("hello");
    expect(result).toContain("world");
    expect(result).toContain("succeeded");
  });

  it("batch writes multiple files", async () => {
    const f1 = path.join(testDir, "w1.txt");
    const f2 = path.join(testDir, "w2.txt");

    const result = await batchWrite([
      { filePath: f1, content: "one" },
      { filePath: f2, content: "two" },
    ]);
    expect(result).toContain("succeeded");

    const r1 = await fs.readFile(f1, "utf-8");
    const r2 = await fs.readFile(f2, "utf-8");
    expect(r1).toBe("one");
    expect(r2).toBe("two");
  });

  it("batch edits multiple files", async () => {
    const f1 = path.join(testDir, "e1.txt");
    const f2 = path.join(testDir, "e2.txt");
    await fs.writeFile(f1, "hello old", "utf-8");
    await fs.writeFile(f2, "goodbye old", "utf-8");

    const result = await batchEdit([
      {
        filePath: f1,
        replacements: [{ oldString: "old", newString: "new" }],
      },
      {
        filePath: f2,
        replacements: [{ oldString: "old", newString: "new" }],
      },
    ]);
    expect(result).toContain("succeeded");

    const r1 = await fs.readFile(f1, "utf-8");
    const r2 = await fs.readFile(f2, "utf-8");
    expect(r1).toBe("hello new");
    expect(r2).toBe("goodbye new");
  });

  it("batch deletes multiple files", async () => {
    const f1 = path.join(testDir, "d1.txt");
    const f2 = path.join(testDir, "d2.txt");
    await fs.writeFile(f1, "x", "utf-8");
    await fs.writeFile(f2, "y", "utf-8");

    const result = await batchDelete([f1, f2]);
    expect(result).toContain("succeeded");

    await expect(fs.access(f1)).rejects.toThrow();
    await expect(fs.access(f2)).rejects.toThrow();
  });

  it("batch copies multiple files", async () => {
    const src1 = path.join(testDir, "src1.txt");
    const dest1 = path.join(testDir, "dest1.txt");
    await fs.writeFile(src1, "copy me", "utf-8");

    const result = await batchCopy([{ source: src1, destination: dest1 }]);
    expect(result).toContain("succeeded");

    const r = await fs.readFile(dest1, "utf-8");
    expect(r).toBe("copy me");
  });

  it("batch moves multiple files", async () => {
    const src1 = path.join(testDir, "move-src.txt");
    const dest1 = path.join(testDir, "move-dest.txt");
    await fs.writeFile(src1, "move me", "utf-8");

    const result = await batchMove([{ source: src1, destination: dest1 }]);
    expect(result).toContain("succeeded");

    const r = await fs.readFile(dest1, "utf-8");
    expect(r).toBe("move me");

    await expect(fs.access(src1)).rejects.toThrow();
  });
});
