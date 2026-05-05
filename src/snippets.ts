// BlackWhite — MCP DevKit
import { promises as fs } from "fs";
import path from "path";
import os from "os";

interface Snippet {
  id: string;
  name: string;
  code: string;
  language: string;
  tags: string[];
  description?: string;
  createdAt: string;
  updatedAt: string;
  accessCount: number;
  lastAccessedAt: string;
}

const SNIPPETS_FILE = path.join(os.homedir(), ".mcp-devkit", "snippets.json");

async function loadSnippets(): Promise<Record<string, Snippet>> {
  try {
    const data = await fs.readFile(SNIPPETS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function saveSnippets(data: Record<string, Snippet>) {
  await fs.mkdir(path.dirname(SNIPPETS_FILE), { recursive: true });
  await fs.writeFile(SNIPPETS_FILE, JSON.stringify(data, null, 2), "utf-8");
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function detectLanguage(code: string, filename?: string): string {
  if (filename) {
    const ext = path.extname(filename).toLowerCase();
    const extMap: Record<string, string> = {
      ".ts": "typescript",
      ".tsx": "typescript-react",
      ".js": "javascript",
      ".jsx": "javascript-react",
      ".py": "python",
      ".rs": "rust",
      ".go": "go",
      ".java": "java",
      ".kt": "kotlin",
      ".rb": "ruby",
      ".php": "php",
      ".c": "c",
      ".cpp": "cpp",
      ".cs": "csharp",
      ".swift": "swift",
      ".dart": "dart",
      ".vue": "vue",
      ".svelte": "svelte",
      ".astro": "astro",
      ".html": "html",
      ".css": "css",
      ".scss": "scss",
      ".sass": "sass",
      ".less": "less",
      ".json": "json",
      ".yaml": "yaml",
      ".yml": "yaml",
      ".toml": "toml",
      ".md": "markdown",
      ".sh": "bash",
      ".ps1": "powershell",
      ".sql": "sql",
      ".graphql": "graphql",
      ".prisma": "prisma",
    };
    if (extMap[ext]) return extMap[ext];
  }

  if (code.includes("interface ") || code.includes(": string") || code.includes(": number")) return "typescript";
  if (code.includes("import React") || code.includes("useState") || code.includes("useEffect"))
    return "typescript-react";
  if (code.includes("function ") || code.includes("const ") || code.includes("let ") || code.includes("var "))
    return "javascript";
  if (code.includes("def ") || (code.includes("import ") && code.includes("as "))) return "python";
  if (code.includes("fn ") || code.includes("impl ") || (code.includes("use ") && code.includes("::"))) return "rust";
  if (code.includes("func ") && code.includes("package ")) return "go";
  if (code.includes("public class") || code.includes("private ")) return "java";
  if (code.includes("<?php")) return "php";
  if (code.includes("class <<")) return "ruby";
  if (code.includes("<template>") || code.includes("v-if=")) return "vue";
  if (code.includes("{#if") || code.includes("on:click")) return "svelte";
  if (code.includes("---") && code.includes("<")) return "astro";
  if (code.includes("SELECT ") && code.includes("FROM ")) return "sql";
  if (code.includes("<!DOCTYPE") || code.includes("<html")) return "html";
  if (code.includes("{") && code.includes("}") && code.includes("margin")) return "css";
  if (code.includes("#!/bin/bash") || code.includes("echo ")) return "bash";

  return "text";
}

export async function saveSnippet(
  name: string,
  code: string,
  language?: string,
  tags: string[] = [],
  description?: string,
  filename?: string,
): Promise<string> {
  const snippets = await loadSnippets();
  const id = generateId();
  const now = new Date().toISOString();
  const detectedLang = language || detectLanguage(code, filename);

  const snippet: Snippet = {
    id,
    name,
    code,
    language: detectedLang,
    tags: tags.map((t) => t.toLowerCase()),
    description,
    createdAt: now,
    updatedAt: now,
    accessCount: 0,
    lastAccessedAt: now,
  };

  snippets[id] = snippet;
  await saveSnippets(snippets);

  return `Saved snippet "${name}" (${detectedLang}) with id #${id}.`;
}

export async function findSnippet(query: string, language?: string, limit = 10): Promise<string> {
  const snippets = await loadSnippets();
  const q = query.toLowerCase();
  const results: Array<{ snippet: Snippet; score: number }> = [];

  for (const snippet of Object.values(snippets)) {
    // Skip non-matching languages entirely when language filter is active
    if (language && snippet.language.toLowerCase() !== language.toLowerCase()) {
      continue;
    }

    let score = 0;
    if (snippet.name.toLowerCase().includes(q)) score += 10;
    if (snippet.description?.toLowerCase().includes(q)) score += 5;
    if (snippet.code.toLowerCase().includes(q)) score += 3;
    if (snippet.tags.some((t) => t.includes(q))) score += 4;
    if (snippet.language.toLowerCase().includes(q)) score += 6;

    if (score > 0) results.push({ snippet, score });
  }

  results.sort((a, b) => b.score - a.score);
  const top = results.slice(0, limit);

  if (top.length === 0) {
    return `No snippets found for "${query}"${language ? ` in ${language}` : ""}.`;
  }

  for (const { snippet } of top) {
    snippet.accessCount++;
    snippet.lastAccessedAt = new Date().toISOString();
  }
  await saveSnippets(Object.fromEntries(top.map((r) => [r.snippet.id, r.snippet])));

  const lines: string[] = [`Found ${top.length} snippet(s) for "${query}":`, ""];
  for (const { snippet, score } of top) {
    lines.push(`## ${snippet.name} (#${snippet.id}) [${snippet.language}]`);
    if (snippet.description) lines.push(`Description: ${snippet.description}`);
    lines.push(`Tags: ${snippet.tags.join(", ") || "none"} | Score: ${score.toFixed(1)}`);
    lines.push("```" + snippet.language);
    lines.push(snippet.code);
    lines.push("```");
    lines.push("");
  }
  return lines.join("\n");
}

export async function getSnippet(id: string): Promise<string> {
  const snippets = await loadSnippets();
  const snippet = snippets[id];
  if (!snippet) return `Snippet #${id} not found.`;

  snippet.accessCount++;
  snippet.lastAccessedAt = new Date().toISOString();
  await saveSnippets(snippets);

  const lines = [
    `## ${snippet.name} (#${snippet.id}) [${snippet.language}]`,
    snippet.description ? `Description: ${snippet.description}` : "",
    `Tags: ${snippet.tags.join(", ") || "none"}`,
    `Created: ${snippet.createdAt} | Accessed ${snippet.accessCount} times`,
    "",
    "```" + snippet.language,
    snippet.code,
    "```",
  ];
  return lines.filter(Boolean).join("\n");
}

export async function listSnippets(language?: string, tag?: string): Promise<string> {
  const snippets = await loadSnippets();
  let items = Object.values(snippets);

  if (language) {
    items = items.filter((s) => s.language.toLowerCase() === language.toLowerCase());
  }
  if (tag) {
    items = items.filter((s) => s.tags.some((t) => t.toLowerCase() === tag.toLowerCase()));
  }

  if (items.length === 0) {
    const filters = [language ? `language:${language}` : "", tag ? `tag:${tag}` : ""].filter(Boolean).join(" and ");
    return filters ? `No snippets with ${filters}.` : "No snippets stored yet.";
  }

  items.sort((a, b) => b.accessCount - a.accessCount);

  const lines: string[] = [`Snippets (${items.length}):`, ""];
  for (const s of items) {
    const desc = s.description ? ` — ${s.description.slice(0, 40)}${s.description.length > 40 ? "..." : ""}` : "";
    lines.push(`- ${s.name} [#${s.id}] [${s.language}]${desc} (${s.accessCount} views)`);
  }
  return lines.join("\n");
}

export async function deleteSnippet(id: string): Promise<string> {
  const snippets = await loadSnippets();
  if (!snippets[id]) return `Snippet #${id} not found.`;
  const name = snippets[id].name;
  delete snippets[id];
  await saveSnippets(snippets);
  return `Deleted snippet "${name}" (#${id}).`;
}

export async function updateSnippet(
  id: string,
  updates: Partial<Pick<Snippet, "name" | "code" | "language" | "tags" | "description">>,
): Promise<string> {
  const snippets = await loadSnippets();
  const snippet = snippets[id];
  if (!snippet) return `Snippet #${id} not found.`;

  if (updates.name !== undefined) snippet.name = updates.name;
  if (updates.code !== undefined) snippet.code = updates.code;
  if (updates.language !== undefined) snippet.language = updates.language;
  if (updates.tags !== undefined) snippet.tags = updates.tags.map((t) => t.toLowerCase());
  if (updates.description !== undefined) snippet.description = updates.description;
  snippet.updatedAt = new Date().toISOString();

  await saveSnippets(snippets);
  return `Updated snippet "${snippet.name}" (#${id}).`;
}

export async function exportSnippets(exportPath?: string): Promise<string> {
  const snippets = await loadSnippets();
  const items = Object.values(snippets);
  if (items.length === 0) return "No snippets to export.";

  const targetPath = exportPath || path.join(os.homedir(), ".mcp-devkit", "snippets-export.json");
  await fs.writeFile(targetPath, JSON.stringify(snippets, null, 2), "utf-8");
  return `Exported ${items.length} snippets to ${targetPath}.`;
}

export async function importSnippets(importPath: string): Promise<string> {
  try {
    const raw = await fs.readFile(importPath, "utf-8");
    const imported = JSON.parse(raw) as Record<string, Snippet>;
    const existing = await loadSnippets();

    let added = 0;
    let merged = 0;
    for (const [id, snippet] of Object.entries(imported)) {
      if (existing[id]) {
        if (existing[id].updatedAt < snippet.updatedAt) {
          existing[id] = { ...snippet, accessCount: existing[id].accessCount };
          merged++;
        }
      } else {
        existing[id] = snippet;
        added++;
      }
    }

    await saveSnippets(existing);
    return `Imported ${added} new snippets, merged ${merged} updated ones. Total: ${Object.keys(existing).length}.`;
  } catch (err) {
    return `Import failed: ${err instanceof Error ? err.message : String(err)}`;
  }
}
