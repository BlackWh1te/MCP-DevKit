import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { createArchive, extractArchive, gzipFile, gunzipFile } from "../src/archive.js";

const TMP = os.tmpdir();

describe("Archive", () => {
  let testDir: string;
  let outDir: string;

  beforeEach(async () => {
    testDir = path.join(TMP, `archive-test-${Date.now()}`);
    outDir = path.join(TMP, `archive-out-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    await fs.mkdir(outDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
    await fs.rm(outDir, { recursive: true, force: true }).catch(() => {});
  });

  it("creates and extracts a zip archive", async () => {
    const srcFile = path.join(testDir, "file.txt");
    await fs.writeFile(srcFile, "archive content", "utf-8");

    const zipPath = path.join(outDir, "test.zip");
    const createResult = await createArchive([srcFile], zipPath, "zip");
    expect(createResult).toContain("zip");
    expect(createResult).toContain("bytes");

    const extractDir = path.join(outDir, "extracted");
    const extractResult = await extractArchive(zipPath, extractDir);
    expect(extractResult).toContain("Extracted");
  });

  it("compresses and decompresses a file with gzip", async () => {
    const srcFile = path.join(testDir, "gzip-test.txt");
    await fs.writeFile(srcFile, "gzip me please", "utf-8");

    const gzPath = path.join(outDir, "gzip-test.txt.gz");
    const gzipResult = await gzipFile(srcFile, gzPath);
    expect(gzipResult).toContain("Compressed");
    expect(gzipResult).toContain("bytes");

    const outPath = path.join(outDir, "gzip-out.txt");
    const gunzipResult = await gunzipFile(gzPath, outPath);
    expect(gunzipResult).toContain("Decompressed");

    const content = await fs.readFile(outPath, "utf-8");
    expect(content).toBe("gzip me please");
  });
});
