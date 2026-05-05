// BlackWhite — MCP DevKit
import { promises as fs } from "fs";
import path from "path";
import os from "os";

const TODO_FILE = path.join(os.homedir(), ".mcp-devkit", "todos.json");

interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  priority: "low" | "medium" | "high" | "critical";
  tags: string[];
  createdAt: string;
  completedAt?: string;
  dueAt?: string;
  estimatedMinutes?: number;
  blocks: string[];        // IDs this todo blocks
  blockedBy: string[];     // IDs that block this todo
  autoPriority: boolean;   // Was priority auto-detected?
}

interface WorkloadAnalysis {
  totalPending: number;
  totalCompleted: number;
  highPriorityPending: number;
  criticalPending: number;
  overdueCount: number;
  blockedCount: number;
  totalEstimatedMinutes: number;
  avgCompletionTimeMinutes?: number;
  completionRate: number;
  workloadScore: "light" | "moderate" | "heavy" | "overwhelming";
  recommendations: string[];
}

interface TodoGraph {
  nodes: Array<{ id: string; text: string; done: boolean; priority: string }>;
  edges: Array<{ from: string; to: string; type: "blocks" }>;
  criticalPath: string[];
  disconnected: string[];
}

async function loadTodos(): Promise<TodoItem[]> {
  try {
    const data = await fs.readFile(TODO_FILE, "utf-8");
    const parsed = JSON.parse(data);
    // Migrate old todos without new fields
    for (const t of parsed) {
      if (!t.blocks) t.blocks = [];
      if (!t.blockedBy) t.blockedBy = [];
      if (!t.autoPriority) t.autoPriority = false;
    }
    return parsed;
  } catch {
    return [];
  }
}

async function saveTodos(todos: TodoItem[]) {
  await fs.mkdir(path.dirname(TODO_FILE), { recursive: true });
  await fs.writeFile(TODO_FILE, JSON.stringify(todos, null, 2), "utf-8");
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function detectAutoPriority(text: string): "low" | "medium" | "high" | "critical" {
  const lower = text.toLowerCase();
  const criticalKeywords = ["urgent", "asap", "critical", "emergency", "blocking", "broken", "crash", "security", "leak", "vulnerability"];
  const highKeywords = ["important", "high priority", "fix", "bug", "error", "fail", "required", "needed"];
  const lowKeywords = ["nice to have", "later", "eventually", "low priority", "optional", "consider", "maybe"];

  for (const kw of criticalKeywords) {
    if (lower.includes(kw)) return "critical";
  }
  for (const kw of highKeywords) {
    if (lower.includes(kw)) return "high";
  }
  for (const kw of lowKeywords) {
    if (lower.includes(kw)) return "low";
  }
  return "medium";
}

function detectEstimatedMinutes(text: string): number | undefined {
  const patterns = [
    /~(\d+)\s*min/i,
    /estimate[ds]?\s*(\d+)\s*min/i,
    /(\d+)\s*minutes?/i,
    /(\d+)\s*hrs?/i,
    /(\d+)\s*h\b/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      let val = parseInt(m[1], 10);
      if (p.source.includes("hr") || p.source.includes("h\\b")) val *= 60;
      return val;
    }
  }
  return undefined;
}

function parseDueDate(text: string): string | undefined {
  const patterns = [
    /due[:\s]+(\d{4}-\d{2}-\d{2})/i,
    /deadline[:\s]+(\d{4}-\d{2}-\d{2})/i,
    /by[:\s]+(\d{4}-\d{2}-\d{2})/i,
    /tomorrow/i,
    /next week/i,
    /end of (\w+)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const now = new Date();
      if (m[0].toLowerCase() === "tomorrow") {
        now.setDate(now.getDate() + 1);
        return now.toISOString().slice(0, 10);
      }
      if (m[0].toLowerCase() === "next week") {
        now.setDate(now.getDate() + 7);
        return now.toISOString().slice(0, 10);
      }
      if (m[1]) return m[1];
    }
  }
  return undefined;
}

export async function createTodo(
  text: string,
  priority?: "low" | "medium" | "high" | "critical",
  tags: string[] = [],
  blocks: string[] = [],
  blockedBy: string[] = [],
  dueAt?: string,
  estimatedMinutes?: number
): Promise<string> {
  const todos = await loadTodos();

  const autoDetectedPriority = detectAutoPriority(text);
  const finalPriority = priority || autoDetectedPriority;
  const autoPriority = !priority;

  const autoEstimated = detectEstimatedMinutes(text);
  const finalEstimated = estimatedMinutes ?? autoEstimated;

  const autoDue = parseDueDate(text);
  const finalDue = dueAt || autoDue;

  const todo: TodoItem = {
    id: generateId(),
    text,
    done: false,
    priority: finalPriority,
    tags,
    createdAt: new Date().toISOString(),
    dueAt: finalDue,
    estimatedMinutes: finalEstimated,
    blocks,
    blockedBy,
    autoPriority,
  };

  // Validate dependency IDs
  const allIds = new Set(todos.map((t) => t.id));
  const invalidBlocks = blocks.filter((id) => !allIds.has(id));
  const invalidBlockedBy = blockedBy.filter((id) => !allIds.has(id));

  todos.push(todo);
  await saveTodos(todos);

  let msg = `Created todo #${todo.id}: "${text}" [${finalPriority}]${autoPriority ? " (auto-detected)" : ""}`;
  if (finalDue) msg += ` due:${finalDue}`;
  if (finalEstimated) msg += ` ~${finalEstimated}min`;
  if (invalidBlocks.length) msg += `\nWarning: unknown block IDs: ${invalidBlocks.join(", ")}`;
  if (invalidBlockedBy.length) msg += `\nWarning: unknown blockedBy IDs: ${invalidBlockedBy.join(", ")}`;
  return msg;
}

export async function listTodos(filter?: { done?: boolean; priority?: string; tag?: string; overdue?: boolean }): Promise<string> {
  let todos = await loadTodos();

  if (filter?.done !== undefined) {
    todos = todos.filter((t) => t.done === filter.done);
  }
  if (filter?.priority) {
    todos = todos.filter((t) => t.priority === filter.priority);
  }
  if (filter?.tag) {
    todos = todos.filter((t) => t.tags.includes(filter.tag!));
  }
  if (filter?.overdue) {
    const today = new Date().toISOString().slice(0, 10);
    todos = todos.filter((t) => !t.done && t.dueAt && t.dueAt < today);
  }

  if (todos.length === 0) {
    const filters = [];
    if (filter?.done !== undefined) filters.push(filter.done ? "completed" : "pending");
    if (filter?.priority) filters.push(`priority:${filter.priority}`);
    if (filter?.tag) filters.push(`tag:${filter.tag}`);
    if (filter?.overdue) filters.push("overdue");
    return filters.length > 0 ? `No ${filters.join(" ")} todos found.` : "No todos yet. Create one with create_todo.";
  }

  const now = new Date().toISOString().slice(0, 10);
  const allTodos = await loadTodos();
  const allMap = new Map(allTodos.map((t) => [t.id, t]));

  const lines: string[] = [`Todos (${todos.length}):`, ""];
  for (const t of todos.sort((a, b) => {
    const pMap = { critical: 4, high: 3, medium: 2, low: 1 };
    // Overdue items first
    const aOverdue = !a.done && a.dueAt && a.dueAt < now ? 1 : 0;
    const bOverdue = !b.done && b.dueAt && b.dueAt < now ? 1 : 0;
    return bOverdue - aOverdue || pMap[b.priority] - pMap[a.priority] || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  })) {
    const status = t.done ? "[x]" : "[ ]";
    const tagStr = t.tags.length ? ` (${t.tags.join(", ")})` : "";
    const dueStr = t.dueAt ? (t.dueAt < now && !t.done ? ` OVERDUE:${t.dueAt}` : ` due:${t.dueAt}`) : "";
    const estStr = t.estimatedMinutes ? ` ~${t.estimatedMinutes}m` : "";
    const blockStr = t.blockedBy.length ? ` [BLOCKED by:${t.blockedBy.map((id) => allMap.get(id)?.text.slice(0, 20) || id).join(", ")}]` : "";
    lines.push(`${status} ${t.text} [${t.priority}]${tagStr}${dueStr}${estStr}${blockStr} — #${t.id}`);
  }
  return lines.join("\n");
}

export async function completeTodo(id: string): Promise<string> {
  const todos = await loadTodos();
  const todo = todos.find((t) => t.id === id);
  if (!todo) return `Todo #${id} not found.`;
  todo.done = true;
  todo.completedAt = new Date().toISOString();

  // Check if any blocked todos are now unblocked
  const unblocked = todos.filter((t) => t.blockedBy.includes(id) && !t.done);
  await saveTodos(todos);

  let msg = `Completed: "${todo.text}"`;
  if (unblocked.length) {
    msg += `\nNow unblocked: ${unblocked.map((t) => `"${t.text.slice(0, 30)}" (#${t.id})`).join(", ")}`;
  }
  return msg;
}

export async function deleteTodo(id: string): Promise<string> {
  const todos = await loadTodos();
  const idx = todos.findIndex((t) => t.id === id);
  if (idx === -1) return `Todo #${id} not found.`;
  const removed = todos.splice(idx, 1)[0];

  // Clean up references
  for (const t of todos) {
    t.blocks = t.blocks.filter((b) => b !== id);
    t.blockedBy = t.blockedBy.filter((b) => b !== id);
  }

  await saveTodos(todos);
  return `Deleted: "${removed.text}"`;
}

export async function updateTodo(
  id: string,
  updates: Partial<Pick<TodoItem, "text" | "priority" | "tags" | "dueAt" | "estimatedMinutes" | "blocks" | "blockedBy">>
): Promise<string> {
  const todos = await loadTodos();
  const todo = todos.find((t) => t.id === id);
  if (!todo) return `Todo #${id} not found.`;

  if (updates.text !== undefined) todo.text = updates.text;
  if (updates.priority !== undefined) { todo.priority = updates.priority; todo.autoPriority = false; }
  if (updates.tags !== undefined) todo.tags = updates.tags;
  if (updates.dueAt !== undefined) todo.dueAt = updates.dueAt;
  if (updates.estimatedMinutes !== undefined) todo.estimatedMinutes = updates.estimatedMinutes;
  if (updates.blocks !== undefined) todo.blocks = updates.blocks;
  if (updates.blockedBy !== undefined) todo.blockedBy = updates.blockedBy;

  await saveTodos(todos);
  return `Updated todo #${id}.`;
}

export async function analyzeWorkload(): Promise<string> {
  const todos = await loadTodos();
  const pending = todos.filter((t) => !t.done);
  const completed = todos.filter((t) => t.done);
  const now = new Date().toISOString().slice(0, 10);

  const highPriorityPending = pending.filter((t) => t.priority === "high" || t.priority === "critical");
  const criticalPending = pending.filter((t) => t.priority === "critical");
  const overdue = pending.filter((t) => t.dueAt && t.dueAt < now);
  const blocked = pending.filter((t) => t.blockedBy.length > 0);

  const totalEst = pending.reduce((sum, t) => sum + (t.estimatedMinutes || 0), 0);

  // Calculate average completion time for completed todos with both created and completed timestamps
  const completedWithTimes = completed.filter((t) => t.completedAt);
  let avgCompletionTime: number | undefined;
  if (completedWithTimes.length > 0) {
    const times = completedWithTimes.map((t) => {
      const created = new Date(t.createdAt).getTime();
      const done = new Date(t.completedAt!).getTime();
      return (done - created) / 60000;
    });
    avgCompletionTime = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  }

  const completionRate = todos.length > 0 ? Math.round((completed.length / todos.length) * 100) : 0;

  let workloadScore: WorkloadAnalysis["workloadScore"] = "light";
  if (criticalPending.length > 2 || overdue.length > 3 || totalEst > 480) workloadScore = "overwhelming";
  else if (criticalPending.length > 0 || overdue.length > 1 || totalEst > 240) workloadScore = "heavy";
  else if (highPriorityPending.length > 2 || totalEst > 120) workloadScore = "moderate";

  const recommendations: string[] = [];
  if (criticalPending.length > 0) recommendations.push(`Address ${criticalPending.length} critical todo(s) immediately.`);
  if (overdue.length > 0) recommendations.push(`Resolve ${overdue.length} overdue item(s).`);
  if (blocked.length > 0) recommendations.push(`Unblock ${blocked.length} item(s) by completing dependencies.`);
  if (totalEst > 240) recommendations.push(`Total estimate ${totalEst}min — consider breaking down large tasks.`);
  if (completionRate < 30 && todos.length > 5) recommendations.push(`Completion rate is ${completionRate}% — focus on finishing existing tasks before adding new ones.`);
  if (recommendations.length === 0) recommendations.push("Workload looks healthy. Keep it up!");

  const analysis: WorkloadAnalysis = {
    totalPending: pending.length,
    totalCompleted: completed.length,
    highPriorityPending: highPriorityPending.length,
    criticalPending: criticalPending.length,
    overdueCount: overdue.length,
    blockedCount: blocked.length,
    totalEstimatedMinutes: totalEst,
    avgCompletionTimeMinutes: avgCompletionTime,
    completionRate,
    workloadScore,
    recommendations,
  };

  const lines = [
    "# Workload Analysis",
    "",
    `- Pending: ${analysis.totalPending}`,
    `- Completed: ${analysis.totalCompleted}`,
    `- High/Critical Priority Pending: ${analysis.highPriorityPending} (${analysis.criticalPending} critical)`,
    `- Overdue: ${analysis.overdueCount}`,
    `- Blocked: ${analysis.blockedCount}`,
    `- Total Estimated Time: ${analysis.totalEstimatedMinutes}min${analysis.totalEstimatedMinutes >= 60 ? ` (${Math.round(analysis.totalEstimatedMinutes / 60 * 10) / 10}h)` : ""}`,
    analysis.avgCompletionTimeMinutes !== undefined ? `- Avg Completion Time: ${analysis.avgCompletionTimeMinutes}min` : "",
    `- Completion Rate: ${analysis.completionRate}%`,
    `- Workload Score: ${analysis.workloadScore.toUpperCase()}`,
    "",
    "## Recommendations",
    ...analysis.recommendations.map((r) => `- ${r}`),
  ];
  return lines.filter(Boolean).join("\n");
}

export async function getTodoGraph(): Promise<string> {
  const todos = await loadTodos();
  const pending = todos.filter((t) => !t.done);
  const allMap = new Map(todos.map((t) => [t.id, t]));

  const nodes = pending.map((t) => ({
    id: t.id,
    text: t.text.slice(0, 40),
    done: t.done,
    priority: t.priority,
  }));

  const edges: TodoGraph["edges"] = [];
  for (const t of pending) {
    for (const blockedId of t.blocks) {
      if (allMap.has(blockedId) && !allMap.get(blockedId)!.done) {
        edges.push({ from: t.id, to: blockedId, type: "blocks" });
      }
    }
  }

  // Find critical path: longest dependency chain
  function longestPath(id: string, visited: Set<string>): string[] {
    if (visited.has(id)) return [id + " (cycle!)"];
    visited.add(id);
    const outgoing = edges.filter((e) => e.from === id).map((e) => e.to);
    if (outgoing.length === 0) return [id];
    let longest: string[] = [];
    for (const next of outgoing) {
      const path = longestPath(next, new Set(visited));
      if (path.length > longest.length) longest = path;
    }
    return [id, ...longest];
  }

  let criticalPath: string[] = [];
  for (const n of nodes) {
    const p = longestPath(n.id, new Set());
    if (p.length > criticalPath.length) criticalPath = p;
  }

  const connectedIds = new Set(edges.flatMap((e) => [e.from, e.to]));
  const disconnected = nodes.filter((n) => !connectedIds.has(n.id)).map((n) => n.id);

  const lines = [
    "# Todo Dependency Graph",
    "",
    `## Nodes (${nodes.length})`,
    ...nodes.map((n) => `- ${n.id}: "${n.text}" [${n.priority}]`),
    "",
    `## Dependencies (${edges.length})`,
    ...edges.map((e) => `- ${e.from} → ${e.to}`),
    "",
    "## Critical Path (longest chain)",
    ...criticalPath.map((id, i) => `${" ".repeat(i * 2)}- ${id}`),
    "",
    disconnected.length ? `## Disconnected (${disconnected.length}): ${disconnected.join(", ")}` : "## All items connected.",
  ];

  return lines.join("\n");
}

export async function getNextTodo(): Promise<string> {
  const todos = await loadTodos();
  const pending = todos.filter((t) => !t.done);
  if (pending.length === 0) return "No pending todos. Great job!";

  const now = new Date().toISOString().slice(0, 10);
  const allMap = new Map(todos.map((t) => [t.id, t]));

  // Score each todo: higher = more urgent
  const scored = pending.map((t) => {
    let score = 0;
    const pMap = { critical: 100, high: 50, medium: 20, low: 5 };
    score += pMap[t.priority] || 10;

    if (t.dueAt) {
      const daysUntilDue = (new Date(t.dueAt).getTime() - new Date(now).getTime()) / 86400000;
      if (daysUntilDue < 0) score += 200; // Overdue
      else if (daysUntilDue <= 1) score += 100;
      else if (daysUntilDue <= 3) score += 50;
      else if (daysUntilDue <= 7) score += 20;
    }

    // Penalize blocked items
    const blockers = t.blockedBy.filter((id) => !allMap.get(id)?.done);
    score -= blockers.length * 40;

    // Bonus for items that unblock many others
    score += t.blocks.filter((id) => !allMap.get(id)?.done).length * 15;

    // Shorter tasks get slight boost
    if (t.estimatedMinutes && t.estimatedMinutes <= 15) score += 10;

    return { todo: t, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];
  const blockers = top.todo.blockedBy.filter((id) => !allMap.get(id)?.done);

  const lines = [
    `# Next Recommended Todo`,
    ``,
    `"${top.todo.text}" [#${top.todo.id}]`,
    `- Priority: ${top.todo.priority}${top.todo.autoPriority ? " (auto)" : ""}`,
    top.todo.dueAt ? `- Due: ${top.todo.dueAt}${top.todo.dueAt < now ? " (OVERDUE)" : ""}` : "",
    top.todo.estimatedMinutes ? `- Estimated: ${top.todo.estimatedMinutes}min` : "",
    blockers.length ? `- Blocked by: ${blockers.map((id) => `"${allMap.get(id)?.text.slice(0, 25)}"`).join(", ")}` : "",
    `- Score: ${top.score}`,
    ``,
    `Run \`complete_todo\` with id "${top.todo.id}" to mark done.`,
  ];
  return lines.filter(Boolean).join("\n");
}
