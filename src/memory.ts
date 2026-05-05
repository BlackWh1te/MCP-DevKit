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
  summary?: string;
  relatedKeys?: string[];
  accessCount: number;
  lastAccessedAt: string;
  importance: number;
  sentiment: "positive" | "neutral" | "negative";
  category?: string;
  memoryDecay: number;
  autoTags?: string[];
}

interface MemoryHealthReport {
  total: number;
  active: number;
  stale: number;
  avgImportance: number;
  sentimentDistribution: Record<string, number>;
  topCategories: Array<{ category: string; count: number }>;
  memoryGrowth: number;
  unusedMemories: number;
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

  const sentiment = analyzeSentiment(content);
  const importance = calculateImportance(content, tags);
  const category = detectCategory(content, tags);
  const autoTags = suggestTags(content, tags);
  const allTags = [...new Set([...tags, ...autoTags])];

  const existing = data[key];

  if (existing) {
    data[key] = {
      ...existing,
      content,
      tags: allTags,
      updatedAt: now,
      importance: Math.min(existing.importance + 0.5, 10),
      sentiment: existing.sentiment === sentiment ? sentiment : "neutral",
      category: category || existing.category,
      accessCount: existing.accessCount + 1,
      lastAccessedAt: now,
      autoTags,
    };

    const similar = findSimilarKeysSync(key, content, allTags, data, 0.85);
    if (similar.length > 0) {
      for (const sim of similar) {
        if (sim.key !== key && data[sim.key]) {
          data[sim.key].relatedKeys = [...(data[sim.key].relatedKeys || []), key];
        }
      }
      data[key].relatedKeys = similar.map(s => s.key).filter(k => k !== key);
    }

    saveMemorySync(data);
    return `Updated "${key}" (importance: ${data[key].importance.toFixed(1)}, sentiment: ${sentiment}).`;
  }

  data[key] = {
    key,
    content,
    tags: allTags,
    createdAt: now,
    updatedAt: now,
    accessCount: 0,
    lastAccessedAt: now,
    importance,
    sentiment,
    category,
    memoryDecay: 1.0,
    autoTags,
    relatedKeys: [],
  };

  const related = findSimilarKeysSync(key, content, allTags, data, 0.5);
  if (related.length > 0) {
    data[key].relatedKeys = related.map(r => r.key).filter(k => k !== key).slice(0, 5);
  }

  saveMemorySync(data);
  return `Remembered "${key}" (${allTags.length ? `tags: ${allTags.join(", ")}` : "no tags"}, importance: ${importance.toFixed(1)}, sentiment: ${sentiment}).`;
}

export async function recall(query: string, limit = 10, includeDecay = true): Promise<string> {
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
    if (item.category?.toLowerCase().includes(q)) score += 4;
    score += Math.min(item.accessCount * 0.5, 5);
    score += item.importance * 0.8;

    if (includeDecay) {
      const decay = calculateDecay(item);
      score *= decay;
    }

    if (score > 0) results.push({ item, score });
  }

  results.sort((a, b) => b.score - a.score);
  const top = results.slice(0, limit);

  if (top.length === 0) return `No memories found for "${query}".`;

  for (const { item } of top) {
    item.accessCount++;
    item.lastAccessedAt = new Date().toISOString();
    item.memoryDecay = Math.min(item.memoryDecay + 0.1, 1.0);
  }

  await saveMemory(data);

  const lines: string[] = [`Found ${top.length} memory(s) for "${query}":`, ""];
  for (const { item, score } of top) {
    lines.push(`## ${item.key}`);
    lines.push(`Tags: ${item.tags.join(", ") || "none"} | Category: ${item.category || "uncategorized"}`);
    lines.push(`Updated: ${item.updatedAt} | Accessed ${item.accessCount} times | Score: ${score.toFixed(1)}`);
    lines.push(`Importance: ${item.importance.toFixed(1)} | Sentiment: ${item.sentiment}`);
    if (item.summary) lines.push(`Summary: ${item.summary}`);
    if (item.relatedKeys && item.relatedKeys.length > 0) {
      lines.push(`Related: ${item.relatedKeys.join(", ")}`);
    }
    lines.push(item.content);
    lines.push("");
  }
  return lines.join("\n");
}

export async function listMemories(tag?: string, category?: string): Promise<string> {
  const data = await loadMemory();
  const items = Object.values(data).filter((item) => {
    let match = true;
    if (tag) {
      match = match && item.tags.some((t) => t.toLowerCase() === tag.toLowerCase());
    }
    if (category) {
      match = match && item.category?.toLowerCase() === category.toLowerCase();
    }
    return match;
  });

  if (items.length === 0) {
    const filters = [tag ? `tag "${tag}"` : "", category ? `category "${category}"` : ""]
      .filter(Boolean)
      .join(" and ");
    return filters ? `No memories with ${filters}.` : "No memories stored yet.";
  }

  const lines: string[] = [`Stored memories (${items.length}):`, ""];
  for (const item of items) {
    const decay = calculateDecay(item);
    const freshness = decay > 0.8 ? "fresh" : decay > 0.5 ? "fading" : "stale";
    lines.push(`- ${item.key} [${item.tags.join(", ") || "no tags"}] [${item.category || "uncat"}] [${item.sentiment}] — ${item.updatedAt} — ${freshness}`);
  }
  return lines.join("\n");
}

export async function getMemoryHealth(): Promise<string> {
  const data = await loadMemory();
  const items = Object.values(data);
  const now = Date.now();

  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  let active = 0;
  let stale = 0;
  let unused = 0;
  let totalImportance = 0;
  const sentimentDist: Record<string, number> = {};
  const categoryCounts = new Map<string, number>();
  let recentlyAdded = 0;

  for (const item of items) {
    const created = new Date(item.createdAt).getTime();
    const lastAccess = new Date(item.lastAccessedAt).getTime();
    const decay = calculateDecay(item);

    if (decay > 0.5) active++;
    else stale++;

    if (lastAccess < thirtyDaysAgo) unused++;
    if (created > sevenDaysAgo) recentlyAdded++;

    totalImportance += item.importance;
    sentimentDist[item.sentiment] = (sentimentDist[item.sentiment] || 0) + 1;

    const cat = item.category || "uncategorized";
    categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
  }

  const report: MemoryHealthReport = {
    total: items.length,
    active,
    stale,
    avgImportance: items.length > 0 ? totalImportance / items.length : 0,
    sentimentDistribution: sentimentDist,
    topCategories: Array.from(categoryCounts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    memoryGrowth: recentlyAdded,
    unusedMemories: unused,
  };

  const lines = [
    "# Memory Health Report",
    "",
    `- Total memories: ${report.total}`,
    `- Active (fresh/fading): ${report.active}`,
    `- Stale memories: ${report.stale}`,
    `- Average importance: ${report.avgImportance.toFixed(2)}`,
    `- Memories added this week: ${report.memoryGrowth}`,
    `- Unused (30d+): ${report.unusedMemories}`,
    "",
    "## Sentiment Distribution",
    ...Object.entries(report.sentimentDistribution).map(([k, v]) => `  ${k}: ${v}`),
    "",
    "## Top Categories",
    ...report.topCategories.map(c => `  ${c.category}: ${c.count}`),
    "",
    report.stale > report.active ? "WARNING: More stale than active memories -- consider reviewing or pruning." : "Memory health looks good.",
  ];

  return lines.join("\n");
}

export async function pruneMemories(keepCount?: number): Promise<string> {
  const data = await loadMemory();
  const items = Object.values(data);

  if (items.length === 0) return "No memories to prune.";

  const scored = items.map(item => {
    const decay = calculateDecay(item);
    const score = item.importance * 2 + item.accessCount + decay * 5;
    return { key: item.key, score, item };
  });

  scored.sort((a, b) => b.score - a.score);

  const keep = keepCount ?? Math.max(Math.floor(items.length * 0.8), 10);
  const keepKeys = new Set(scored.slice(0, keep).map(s => s.key));
  let removed = 0;

  for (const key of Object.keys(data)) {
    if (!keepKeys.has(key)) {
      delete data[key];
      removed++;
    }
  }

  await saveMemory(data);
  return `Pruned ${removed} low-value memories. Kept ${keep} memories.`;
}

export async function consolidateMemories(): Promise<string> {
  const data = await loadMemory();
  const items = Object.values(data);
  const merged: Array<{ key1: string; key2: string; similarity: number }> = [];

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const item1 = items[i];
      const item2 = items[j];

      const keySim = calculateSimilarity(item1.key.toLowerCase(), item2.key.toLowerCase());
      const contentSim = calculateSimilarity(item1.content.toLowerCase(), item2.content.toLowerCase());
      const avgSim = (keySim + contentSim) / 2;

      if (avgSim > 0.9) {
        merged.push({ key1: item1.key, key2: item2.key, similarity: avgSim });
        item1.content += `\n\n[merged from ${item2.key}]: ${item2.content}`;
        item1.tags = [...new Set([...item1.tags, ...item2.tags])];
        item1.importance = Math.max(item1.importance, item2.importance);
        item1.relatedKeys = [...(item1.relatedKeys || []), item2.key];
        delete data[item2.key];
      }
    }
  }

  await saveMemory(data);
  return merged.length > 0
    ? `Consolidated ${merged.length} duplicate memory pairs: ${merged.map(m => `${m.key1}<->${m.key2}`).join(", ")}.`
    : "No duplicates found to consolidate.";
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

// AI-powered helper functions

function analyzeSentiment(text: string): "positive" | "neutral" | "negative" {
  const positiveWords = ["good", "great", "excellent", "success", "win", "love", "amazing", "best", "perfect", "awesome", "happy", "joy", "wonderful", "brilliant", "outstanding"];
  const negativeWords = ["bad", "error", "fail", "bug", "issue", "problem", "crash", "broken", "hate", "terrible", "worst", "awful", "disaster", "pain", "frustrating"];

  const lower = text.toLowerCase();
  let pos = 0, neg = 0;

  for (const word of positiveWords) {
    const matches = lower.match(new RegExp(`\\b${word}\\b`, "g"));
    if (matches) pos += matches.length;
  }
  for (const word of negativeWords) {
    const matches = lower.match(new RegExp(`\\b${word}\\b`, "g"));
    if (matches) neg += matches.length;
  }

  if (pos > neg * 1.5) return "positive";
  if (neg > pos * 1.5) return "negative";
  return "neutral";
}

function calculateImportance(content: string, tags: string[]): number {
  let score = 5; // baseline

  if (content.length > 500) score += 1;
  if (content.length > 2000) score += 1;

  const importantTags = ["critical", "important", "api", "security", "architecture", "design", "production", "release", "breaking"];
  for (const tag of tags) {
    if (importantTags.includes(tag.toLowerCase())) score += 1;
  }

  if (content.includes("```")) score += 0.5;
  if (content.includes("http")) score += 0.5;

  return Math.min(score, 10);
}

function detectCategory(content: string, tags: string[]): string {
  const lower = content.toLowerCase();

  if (tags.some(t => ["api", "endpoint", "route"].includes(t.toLowerCase()))) return "api";
  if (tags.some(t => ["ui", "frontend", "css", "html", "component"].includes(t.toLowerCase()))) return "frontend";
  if (tags.some(t => ["db", "database", "sql", "schema", "migration"].includes(t.toLowerCase()))) return "database";
  if (tags.some(t => ["security", "auth", "vulnerability", "xss", "csrf"].includes(t.toLowerCase()))) return "security";
  if (tags.some(t => ["performance", "optimization", "speed", "cache"].includes(t.toLowerCase()))) return "performance";
  if (tags.some(t => ["test", "testing", "spec", "coverage"].includes(t.toLowerCase()))) return "testing";
  if (tags.some(t => ["deploy", "ci", "cd", "pipeline", "release"].includes(t.toLowerCase()))) return "devops";

  if (lower.includes("function") || lower.includes("class") || lower.includes("interface")) return "code";
  if (lower.includes("error") || lower.includes("exception") || lower.includes("bug")) return "debugging";
  if (lower.includes("todo") || lower.includes("fixme") || lower.includes("hack")) return "tech-debt";

  return "general";
}

function suggestTags(content: string, existingTags: string[]): string[] {
  const lower = content.toLowerCase();
  const suggestions: string[] = [];

  const tagPatterns: Record<string, RegExp> = {
    "javascript": /\b(javascript|js|node|npm|typescript|ts)\b/,
    "python": /\b(python|pip|django|flask|fastapi)\b/,
    "react": /\b(react|jsx|hooks|component)\b/,
    "database": /\b(sql|postgres|mysql|mongodb|redis|prisma)\b/,
    "security": /\b(auth|jwt|oauth|encryption|hash|vulnerability|xss|csrf)\b/,
    "performance": /\b(cache|optimize|speed|latency|benchmark|memory)\b/,
    "testing": /\b(test|jest|vitest|cypress|playwright|unit|e2e)\b/,
    "devops": /\b(docker|kubernetes|k8s|ci|cd|deploy|pipeline)\b/,
    "api": /\b(rest|graphql|api|endpoint|swagger|openapi)\b/,
  };

  for (const [tag, pattern] of Object.entries(tagPatterns)) {
    if (pattern.test(lower) && !existingTags.some(t => t.toLowerCase() === tag)) {
      suggestions.push(tag);
    }
  }

  return suggestions.slice(0, 3);
}

function calculateDecay(item: MemoryItem): number {
  const now = Date.now();
  const lastAccess = new Date(item.lastAccessedAt).getTime();
  const age = now - lastAccess;
  const daysSinceAccess = age / (24 * 60 * 60 * 1000);

  const decayRate = 0.05 / Math.max(item.importance * 0.3, 1);
  const decay = Math.exp(-decayRate * daysSinceAccess);

  return Math.max(decay, 0.1);
}

function findSimilarKeysSync(key: string, content: string, tags: string[], data: Record<string, MemoryItem>, threshold: number): Array<{ key: string; similarity: number }> {
  const results: Array<{ key: string; similarity: number }> = [];
  for (const [otherKey, otherItem] of Object.entries(data)) {
    if (otherKey === key) continue;
    const keySim = calculateSimilarity(key.toLowerCase(), otherKey.toLowerCase());
    const contentSim = calculateSimilarity(content.toLowerCase(), otherItem.content.toLowerCase());
    const tagSim = calculateSimilarity(tags.join(" "), otherItem.tags.join(" "));
    const avg = (keySim + contentSim + tagSim) / 3;
    if (avg > threshold) {
      results.push({ key: otherKey, similarity: avg });
    }
  }
  results.sort((a, b) => b.similarity - a.similarity);
  return results;
}

// --- Existing advanced functions upgraded ---

export async function deduplicateMemories(): Promise<string> {
  const data = await loadMemory();
  const items = Object.values(data);
  const duplicates: Array<{ key1: string; key2: string; similarity: number; recommendation: string }> = [];

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const item1 = items[i];
      const item2 = items[j];

      const keySimilarity = calculateSimilarity(item1.key.toLowerCase(), item2.key.toLowerCase());
      const contentSimilarity = calculateSimilarity(item1.content.toLowerCase(), item2.content.toLowerCase());
      const tagSimilarity = calculateSimilarity(item1.tags.join(" "), item2.tags.join(" "));

      const avgSimilarity = (keySimilarity + contentSimilarity + tagSimilarity) / 3;

      if (avgSimilarity > 0.7) {
        let recommendation = "review";
        if (avgSimilarity > 0.9) recommendation = "merge";
        else if (item1.category === item2.category) recommendation = "link";
        duplicates.push({ key1: item1.key, key2: item2.key, similarity: avgSimilarity, recommendation });
      }
    }
  }

  return JSON.stringify({
    totalMemories: items.length,
    duplicateGroups: duplicates.length,
    duplicates: duplicates.slice(0, 20),
  }, null, 2);
}

function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  if (longer.length === 0) return 1;
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[str2.length][str1.length];
}

export async function summarizeMemory(key: string): Promise<string> {
  const data = await loadMemory();
  const item = data[key];

  if (!item) {
    return `Memory "${key}" not found.`;
  }

  if (item.summary) {
    return `Existing summary: ${item.summary}`;
  }

  const sentences = item.content.match(/[^.!?]+[.!?]+/g) || [item.content];
  const importantSentences = sentences.filter(s => {
    const lower = s.toLowerCase();
    return lower.includes("important") || lower.includes("critical") || lower.includes("must") ||
           lower.includes("key") || lower.includes("main") || lower.includes("primary") ||
           lower.includes("always") || lower.includes("never");
  });

  const summary = importantSentences.length > 0
    ? importantSentences.slice(0, 2).join(" ").trim()
    : (sentences[0] || item.content).trim().slice(0, 150) + (item.content.length > 150 ? "..." : "");

  item.summary = summary;
  await saveMemory(data);

  return `Generated summary for "${key}": ${summary}`;
}

export async function findRelatedMemories(key: string, threshold = 0.3): Promise<string> {
  const data = await loadMemory();
  const item = data[key];

  if (!item) {
    return `Memory "${key}" not found.`;
  }

  const related: Array<{ key: string; similarity: number; reason: string }> = [];

  for (const [otherKey, otherItem] of Object.entries(data)) {
    if (otherKey === key) continue;

    const tagSimilarity = calculateSimilarity(item.tags.join(" "), otherItem.tags.join(" "));
    const contentSimilarity = calculateSimilarity(item.content.toLowerCase(), otherItem.content.toLowerCase());
    const categoryMatch = item.category === otherItem.category ? 0.3 : 0;

    const avgSimilarity = (tagSimilarity + contentSimilarity) / 2 + categoryMatch;

    if (avgSimilarity > threshold) {
      let reason = "content similarity";
      if (tagSimilarity > contentSimilarity) reason = "shared tags";
      if (categoryMatch > 0) reason = "same category";
      related.push({ key: otherKey, similarity: avgSimilarity, reason });
    }
  }

  related.sort((a, b) => b.similarity - a.similarity);

  item.relatedKeys = related.slice(0, 5).map(r => r.key);
  await saveMemory(data);

  return JSON.stringify({
    key,
    relatedMemories: related.slice(0, 10),
  }, null, 2);
}

export async function exportMemories(): Promise<string> {
  const data = await loadMemory();
  const backupPath = path.join(os.homedir(), ".mcp-devkit", `memory-backup-${Date.now()}.json`);
  await fs.mkdir(path.dirname(backupPath), { recursive: true });
  await fs.writeFile(backupPath, JSON.stringify(data, null, 2), "utf-8");
  return `Exported ${Object.keys(data).length} memories to ${backupPath}`;
}

export async function importMemories(backupPath: string): Promise<string> {
  try {
    const content = await fs.readFile(backupPath, "utf-8");
    const imported = JSON.parse(content) as Record<string, MemoryItem>;
    const data = await loadMemory();

    let importedCount = 0;
    let updatedCount = 0;
    for (const [key, item] of Object.entries(imported)) {
      if (!data[key]) {
        data[key] = item;
        importedCount++;
      } else {
        data[key].content = item.content + "\n\n[imported]: " + data[key].content;
        data[key].tags = [...new Set([...data[key].tags, ...item.tags])];
        data[key].updatedAt = new Date().toISOString();
        updatedCount++;
      }
    }

    await saveMemory(data);
    return `Imported ${importedCount} new and merged ${updatedCount} existing memories from ${backupPath}`;
  } catch (err: any) {
    return `Error importing memories: ${err.message}`;
  }
}

export async function forgetMemory(key: string): Promise<string> {
  const data = await loadMemory();
  if (!data[key]) {
    return `Memory "${key}" not found.`;
  }
  delete data[key];
  await saveMemory(data);
  return `Forgot memory "${key}".`;
}

export async function updateMemoryImportance(key: string, importance: number): Promise<string> {
  const data = await loadMemory();
  if (!data[key]) {
    return `Memory "${key}" not found.`;
  }
  data[key].importance = Math.max(0, Math.min(10, importance));
  data[key].updatedAt = new Date().toISOString();
  await saveMemory(data);
  return `Updated importance of "${key}" to ${data[key].importance}.`;
}

export async function searchBySentiment(sentiment: "positive" | "neutral" | "negative"): Promise<string> {
  const data = await loadMemory();
  const matches = Object.values(data).filter(item => item.sentiment === sentiment);

  if (matches.length === 0) return `No ${sentiment} memories found.`;

  const lines = [`${matches.length} ${sentiment} memories:`, ""];
  for (const item of matches) {
    lines.push(`- ${item.key} (importance: ${item.importance.toFixed(1)})`);
  }
  return lines.join("\n");
}
