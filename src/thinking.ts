// BlackWhite — MCP DevKit
import { promises as fs } from "fs";
import path from "path";
import os from "os";

interface Thought {
  thought: string;
  thoughtNumber: number;
  totalThoughts: number;
  nextThoughtNeeded: boolean;
  isRevision?: boolean;
  revisesThought?: number;
  branchFromThought?: number;
  branchId?: string;
}

const THINKING_FILE = path.join(os.homedir(), ".mcp-devkit", "thinking.json");

async function loadThinking(): Promise<Thought[]> {
  try {
    const data = await fs.readFile(THINKING_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveThinking(thoughts: Thought[]) {
  await fs.mkdir(path.dirname(THINKING_FILE), { recursive: true });
  await fs.writeFile(THINKING_FILE, JSON.stringify(thoughts, null, 2), "utf-8");
}

export async function think(
  thought: string,
  thoughtNumber: number,
  totalThoughts: number,
  nextThoughtNeeded = true,
  isRevision = false,
  revisesThought?: number,
  branchFromThought?: number,
  branchId?: string
): Promise<string> {
  const thoughts = await loadThinking();

  const t: Thought = {
    thought,
    thoughtNumber,
    totalThoughts,
    nextThoughtNeeded,
    isRevision,
    revisesThought,
    branchFromThought,
    branchId,
  };

  thoughts.push(t);
  await saveThinking(thoughts);

  const lines: string[] = [
    `## Thought ${thoughtNumber}${isRevision ? ` (revises #${revisesThought})` : ""}${branchId ? ` [branch: ${branchId}]` : ""}`,
    `${thought}`,
    "",
    `Progress: ${thoughtNumber}/${totalThoughts}`,
    nextThoughtNeeded ? "Next thought needed: yes" : "Next thought needed: no",
    `Total chain thoughts: ${thoughts.length}`,
  ];

  return lines.join("\n");
}

export async function getThoughts(filter?: string): Promise<string> {
  const thoughts = await loadThinking();

  if (!filter) {
    const lines: string[] = [`# Thinking Session (${thoughts.length} thoughts)`, ""];
    for (const t of thoughts) {
      lines.push(`## ${t.thoughtNumber}${t.isRevision ? `r` : ""}${t.branchId ? ` [${t.branchId}]` : ""}: ${t.thought.slice(0, 100)}${t.thought.length > 100 ? "..." : ""}`);
    }
    return lines.join("\n");
  }

  // Filter by branch or keyword
  const filtered = thoughts.filter(
    (t) =>
      t.branchId?.includes(filter) ||
      t.thought.toLowerCase().includes(filter.toLowerCase())
  );

  const lines: string[] = [
    `# Filtered Thoughts (${filtered.length}/${thoughts.length})`,
    "",
  ];
  for (const t of filtered) {
    lines.push(
      `## ${t.thoughtNumber}: ${t.thought.slice(0, 200)}${t.thought.length > 200 ? "..." : ""}`
    );
  }
  return lines.join("\n");
}

export async function clearThinking(): Promise<string> {
  await fs.writeFile(THINKING_FILE, "[]", "utf-8");
  return "Thinking session cleared.";
}
