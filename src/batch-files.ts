// BlackWhite — MCP DevKit
import { promises as fs } from "fs";
import path from "path";
// Batch file operations — read, write, edit, delete, copy, move multiple files at once

interface BatchReadResult {
  filePath: string;
  content: string;
  success: boolean;
  error?: string;
  lineCount: number;
  sizeBytes: number;
}

interface BatchWriteResult {
  filePath: string;
  success: boolean;
  error?: string;
  bytesWritten: number;
}

interface BatchEditResult {
  filePath: string;
  success: boolean;
  error?: string;
  replacements: number;
}

interface BatchDeleteResult {
  filePath: string;
  success: boolean;
  error?: string;
}

export async function batchRead(filePaths: string[]): Promise<string> {
  const results: BatchReadResult[] = [];

  for (const filePath of filePaths) {
    try {
      const resolved = path.resolve(filePath);
      const stat = await fs.stat(resolved);
      if (!stat.isFile()) {
        results.push({
          filePath: resolved,
          content: "",
          success: false,
          error: "Not a file",
          lineCount: 0,
          sizeBytes: 0,
        });
        continue;
      }

      const content = await fs.readFile(resolved, "utf-8");
      results.push({
        filePath: resolved,
        content,
        success: true,
        lineCount: content.split("\n").length,
        sizeBytes: stat.size,
      });
    } catch (err) {
      results.push({
        filePath: path.resolve(filePath),
        content: "",
        success: false,
        error: err instanceof Error ? err.message : String(err),
        lineCount: 0,
        sizeBytes: 0,
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.length - successCount;

  const lines: string[] = [`# Batch Read Results: ${successCount} succeeded, ${failCount} failed`, ""];

  for (const r of results) {
    if (r.success) {
      lines.push(`## ${r.filePath} (${r.sizeBytes} bytes, ${r.lineCount} lines)`);
      lines.push("```");
      lines.push(r.content.slice(0, 5000)); // Truncate very large files in batch output
      if (r.content.length > 5000) lines.push("... (truncated)");
      lines.push("```");
      lines.push("");
    } else {
      lines.push(`## ${r.filePath} — ERROR: ${r.error}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

export async function batchWrite(writes: Array<{ filePath: string; content: string }>): Promise<string> {
  const results: BatchWriteResult[] = [];

  for (const { filePath, content } of writes) {
    try {
      const resolved = path.resolve(filePath);
      await fs.mkdir(path.dirname(resolved), { recursive: true });
      await fs.writeFile(resolved, content, "utf-8");
      results.push({
        filePath: resolved,
        success: true,
        bytesWritten: Buffer.byteLength(content, "utf-8"),
      });
    } catch (err) {
      results.push({
        filePath: path.resolve(filePath),
        success: false,
        error: err instanceof Error ? err.message : String(err),
        bytesWritten: 0,
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.length - successCount;

  const lines: string[] = [`# Batch Write Results: ${successCount} succeeded, ${failCount} failed`, ""];
  for (const r of results) {
    if (r.success) {
      lines.push(`- OK: ${r.filePath} (${r.bytesWritten} bytes)`);
    } else {
      lines.push(`- FAIL: ${r.filePath} — ${r.error}`);
    }
  }
  return lines.join("\n");
}

export async function batchEdit(
  edits: Array<{ filePath: string; replacements: Array<{ oldString: string; newString: string }> }>,
): Promise<string> {
  const results: BatchEditResult[] = [];

  for (const { filePath, replacements } of edits) {
    try {
      const resolved = path.resolve(filePath);
      let content = await fs.readFile(resolved, "utf-8");
      let totalReplacements = 0;

      for (const { oldString, newString } of replacements) {
        const count = content.split(oldString).length - 1;
        if (count === 1) {
          content = content.replace(oldString, newString);
          totalReplacements++;
        } else if (count === 0) {
          // Skip - string not found
        } else {
          // Multiple matches - skip to avoid unintended changes
          throw new Error(`Found ${count} matches for replacement (expected exactly 1)`);
        }
      }

      if (totalReplacements > 0) {
        await fs.writeFile(resolved, content, "utf-8");
      }

      results.push({
        filePath: resolved,
        success: true,
        replacements: totalReplacements,
      });
    } catch (err) {
      results.push({
        filePath: path.resolve(filePath),
        success: false,
        error: err instanceof Error ? err.message : String(err),
        replacements: 0,
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.length - successCount;

  const lines: string[] = [`# Batch Edit Results: ${successCount} succeeded, ${failCount} failed`, ""];
  for (const r of results) {
    if (r.success) {
      lines.push(`- OK: ${r.filePath} (${r.replacements} replacement(s))`);
    } else {
      lines.push(`- FAIL: ${r.filePath} — ${r.error}`);
    }
  }
  return lines.join("\n");
}

export async function batchDelete(filePaths: string[]): Promise<string> {
  const results: BatchDeleteResult[] = [];

  for (const filePath of filePaths) {
    try {
      const resolved = path.resolve(filePath);
      const stat = await fs.stat(resolved);
      if (stat.isDirectory()) {
        throw new Error("Is a directory — use remove_directory for directories");
      }
      await fs.unlink(resolved);
      results.push({ filePath: resolved, success: true });
    } catch (err) {
      results.push({
        filePath: path.resolve(filePath),
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.length - successCount;

  const lines: string[] = [`# Batch Delete Results: ${successCount} succeeded, ${failCount} failed`, ""];
  for (const r of results) {
    if (r.success) {
      lines.push(`- DELETED: ${r.filePath}`);
    } else {
      lines.push(`- FAIL: ${r.filePath} — ${r.error}`);
    }
  }
  return lines.join("\n");
}

export async function batchCopy(copies: Array<{ source: string; destination: string }>): Promise<string> {
  const results: Array<{ source: string; destination: string; success: boolean; error?: string; bytesCopied: number }> =
    [];

  for (const { source, destination } of copies) {
    try {
      const srcResolved = path.resolve(source);
      const destResolved = path.resolve(destination);
      await fs.mkdir(path.dirname(destResolved), { recursive: true });
      await fs.copyFile(srcResolved, destResolved);
      const stat = await fs.stat(srcResolved);
      results.push({
        source: srcResolved,
        destination: destResolved,
        success: true,
        bytesCopied: stat.size,
      });
    } catch (err) {
      results.push({
        source: path.resolve(source),
        destination: path.resolve(destination),
        success: false,
        error: err instanceof Error ? err.message : String(err),
        bytesCopied: 0,
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.length - successCount;

  const lines: string[] = [`# Batch Copy Results: ${successCount} succeeded, ${failCount} failed`, ""];
  for (const r of results) {
    if (r.success) {
      lines.push(`- COPIED: ${r.source} → ${r.destination} (${r.bytesCopied} bytes)`);
    } else {
      lines.push(`- FAIL: ${r.source} → ${r.destination} — ${r.error}`);
    }
  }
  return lines.join("\n");
}

export async function batchMove(moves: Array<{ source: string; destination: string }>): Promise<string> {
  const results: Array<{ source: string; destination: string; success: boolean; error?: string; bytesMoved: number }> =
    [];

  for (const { source, destination } of moves) {
    try {
      const srcResolved = path.resolve(source);
      const destResolved = path.resolve(destination);
      await fs.mkdir(path.dirname(destResolved), { recursive: true });
      const stat = await fs.stat(srcResolved);
      await fs.rename(srcResolved, destResolved);
      results.push({
        source: srcResolved,
        destination: destResolved,
        success: true,
        bytesMoved: stat.size,
      });
    } catch (err) {
      // If rename fails (cross-device), fall back to copy+delete
      try {
        const srcResolved = path.resolve(source);
        const destResolved = path.resolve(destination);
        await fs.copyFile(srcResolved, destResolved);
        const stat = await fs.stat(srcResolved);
        await fs.unlink(srcResolved);
        results.push({
          source: srcResolved,
          destination: destResolved,
          success: true,
          bytesMoved: stat.size,
        });
      } catch {
        results.push({
          source: path.resolve(source),
          destination: path.resolve(destination),
          success: false,
          error: err instanceof Error ? err.message : String(err),
          bytesMoved: 0,
        });
      }
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.length - successCount;

  const lines: string[] = [`# Batch Move Results: ${successCount} succeeded, ${failCount} failed`, ""];
  for (const r of results) {
    if (r.success) {
      lines.push(`- MOVED: ${r.source} → ${r.destination} (${r.bytesMoved} bytes)`);
    } else {
      lines.push(`- FAIL: ${r.source} → ${r.destination} — ${r.error}`);
    }
  }
  return lines.join("\n");
}
