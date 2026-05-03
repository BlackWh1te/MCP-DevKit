// BlackWhite — MCP DevKit
import { promises as fs } from "fs";
import fsSync from "fs";
import path from "path";
import os from "os";

interface MemoryItem {
  key: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

function getMemoryPath(): string {
  const dataDir = path.join(os.homedir(), ".mcp-devkit");
  return path.join(dataDir, "memory.json");
}

async function ensureDataDir() {
  const dataDir = path.join(os.homedir(), ".mcp-devkit");
  try {
    await fs.mkdir(dataDir, { recursive: true });
  } catch {
    // ignore
  }
}

async function loadMemory(): Promise<Record<string, MemoryItem>> {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(getMemoryPath(), "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveMemory(data: Record<string, MemoryItem>) {
  await ensureDataDir();
  await fs.writeFile(getMemoryPath(), JSON.stringify(data, null, 2), "utf-8");
}

export function remember(key: string, content: string, tags: string[] = []): string {
  const data = loadMemorySync();
  const now = new Date().toISOString();
  data[key] = {
    key,
    content,
    tags,
    createdAt: data[key]?.createdAt ?? now,
    updatedAt: now,
  };
  saveMemorySync(data);
  return `Remembered "${key}" (${tags.length ? `tags: ${tags.join(", ")}` : "no tags"}).`;
}

export async function recall(query: string, limit = 10): Promise<string> {
  const data = await loadMemory();
  const results: Array<{ item: MemoryItem; score: number }> = [];
  const q = query.toLowerCase();

  for (const item of Object.values(data)) {
    let score = 0;
    if (item.key.toLowerCase().includes(q)) score += 10;
    if (item.content.toLowerCase().includes(q)) score += 5;
    for (const tag of item.tags) {
      if (tag.toLowerCase().includes(q)) score += 3;
    }
    if (score > 0) results.push({ item, score });
  }

  results.sort((a, b) => b.score - a.score);
  const top = results.slice(0, limit);

  if (top.length === 0) return `No memories found for "${query}".`;

  const lines: string[] = [`Found ${top.length} memory(s) for "${query}":`, ""];
  for (const { item } of top) {
    lines.push(`## ${item.key}`);
    lines.push(`Tags: ${item.tags.join(", ") || "none"}`);
    lines.push(`Updated: ${item.updatedAt}`);
    lines.push(item.content);
    lines.push("");
  }
  return lines.join("\n");
}

export async function listMemories(tag?: string): Promise<string> {
  const data = await loadMemory();
  const items = Object.values(data).filter((item) => {
    if (!tag) return true;
    return item.tags.some((t) => t.toLowerCase() === tag.toLowerCase());
  });

  if (items.length === 0) {
    return tag ? `No memories with tag "${tag}".` : "No memories stored yet.";
  }

  const lines: string[] = [`Stored memories (${items.length}):`, ""];
  for (const item of items) {
    lines.push(`- ${item.key} [${item.tags.join(", ") || "no tags"}] — ${item.updatedAt}`);
  }
  return lines.join("\n");
}

// Synchronous fallbacks for the synchronous remember path used in index.ts
function loadMemorySync(): Record<string, MemoryItem> {
  try {
    const raw = fsSync.readFileSync(getMemoryPath(), "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveMemorySync(data: Record<string, MemoryItem>) {
  try {
    fsSync.writeFileSync(getMemoryPath(), JSON.stringify(data, null, 2), "utf-8");
  } catch {
    // ignore
  }
}

