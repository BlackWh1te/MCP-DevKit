// BlackWhite — MCP DevKit
import { promises as fs, constants } from "fs";
import path from "path";

export async function readFile(filePath: string): Promise<string> {
  const full = path.resolve(filePath);
  try {
    await fs.access(full, constants.R_OK);
    const data = await fs.readFile(full, "utf-8");
    return data;
  } catch (err: any) {
    return `Error reading file: ${err.message}`;
  }
}

export async function writeFile(filePath: string, content: string): Promise<string> {
  const full = path.resolve(filePath);
  try {
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content, "utf-8");
    return `Wrote ${content.length} bytes to ${full}`;
  } catch (err: any) {
    return `Error writing file: ${err.message}`;
  }
}

export async function editFile(filePath: string, oldString: string, newString: string): Promise<string> {
  const full = path.resolve(filePath);
  try {
    await fs.access(full, constants.R_OK | constants.W_OK);
    const content = await fs.readFile(full, "utf-8");
    const occurrences = content.split(oldString).length - 1;
    if (occurrences === 0) {
      return `Error: old_string not found in file. No changes made.`;
    }
    if (occurrences > 1) {
      return `Error: old_string appears ${occurrences} times. Provide a more unique string.`;
    }
    const updated = content.replace(oldString, newString);
    await fs.writeFile(full, updated, "utf-8");
    return `Edited ${full} (1 replacement). File is now ${updated.length} bytes.`;
  } catch (err: any) {
    return `Error editing file: ${err.message}`;
  }
}

export async function deleteFile(filePath: string): Promise<string> {
  const full = path.resolve(filePath);
  try {
    const stat = await fs.stat(full);
    if (stat.isDirectory()) {
      return `Error: ${full} is a directory. Use delete_directory to remove directories.`;
    }
    await fs.unlink(full);
    return `Deleted file: ${full}`;
  } catch (err: any) {
    return `Error deleting file: ${err.message}`;
  }
}

interface DirEntry {
  name: string;
  type: "file" | "directory";
  size?: number;
}

export async function listDirectory(dirPath: string, maxDepth = 1): Promise<string> {
  const full = path.resolve(dirPath);
  const results: Array<{ path: string; entries: DirEntry[] }> = [];

  async function walk(dir: string, depth: number, prefix: string) {
    if (depth > maxDepth) return;
    try {
      await fs.access(dir, constants.R_OK);
    } catch {
      return;
    }
    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch {
      return;
    }
    const items: DirEntry[] = [];
    for (const name of entries) {
      if (name.startsWith(".")) continue;
      try {
        const stat = await fs.stat(path.join(dir, name));
        items.push({
          name,
          type: stat.isDirectory() ? "directory" : "file",
          size: stat.isFile() ? stat.size : undefined,
        });
      } catch {
        // ignore
      }
    }
    results.push({ path: prefix || ".", entries: items });
    for (const item of items) {
      if (item.type === "directory") {
        await walk(path.join(dir, item.name), depth + 1, prefix ? `${prefix}/${item.name}` : item.name);
      }
    }
  }

  await walk(full, 0, "");

  const lines: string[] = [];
  for (const r of results) {
    lines.push(`${r.path}/`);
    for (const e of r.entries) {
      const sizeStr = e.size !== undefined ? ` (${e.size} bytes)` : "";
      lines.push(`  ${e.type === "directory" ? "📁" : "📄"} ${e.name}${sizeStr}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
