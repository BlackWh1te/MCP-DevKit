// BlackWhite — MCP DevKit
import { promises as fs } from "fs";
import path from "path";
import os from "os";

const TODO_FILE = path.join(os.homedir(), ".mcp-devkit", "todos.json");

interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  priority: "low" | "medium" | "high";
  tags: string[];
  createdAt: string;
  completedAt?: string;
}

async function loadTodos(): Promise<TodoItem[]> {
  try {
    const data = await fs.readFile(TODO_FILE, "utf-8");
    return JSON.parse(data);
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

export async function createTodo(text: string, priority: "low" | "medium" | "high" = "medium", tags: string[] = []): Promise<string> {
  const todos = await loadTodos();
  const todo: TodoItem = {
    id: generateId(),
    text,
    done: false,
    priority,
    tags,
    createdAt: new Date().toISOString(),
  };
  todos.push(todo);
  await saveTodos(todos);
  return `Created todo #${todo.id}: "${text}" [${priority}]`;
}

export async function listTodos(filter?: { done?: boolean; priority?: string; tag?: string }): Promise<string> {
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

  if (todos.length === 0) {
    const filters = [];
    if (filter?.done !== undefined) filters.push(filter.done ? "completed" : "pending");
    if (filter?.priority) filters.push(`priority:${filter.priority}`);
    if (filter?.tag) filters.push(`tag:${filter.tag}`);
    return filters.length > 0 ? `No ${filters.join(" ")} todos found.` : "No todos yet. Create one with create_todo.";
  }

  const lines: string[] = [`Todos (${todos.length}):`, ""];
  for (const t of todos.sort((a, b) => {
    const pMap = { high: 3, medium: 2, low: 1 };
    return pMap[b.priority] - pMap[a.priority] || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  })) {
    const status = t.done ? "[x]" : "[ ]";
    const tagStr = t.tags.length ? ` (${t.tags.join(", ")})` : "";
    lines.push(`${status} ${t.text} [${t.priority}]${tagStr} — #${t.id}`);
  }
  return lines.join("\n");
}

export async function completeTodo(id: string): Promise<string> {
  const todos = await loadTodos();
  const todo = todos.find((t) => t.id === id);
  if (!todo) return `Todo #${id} not found.`;
  todo.done = true;
  todo.completedAt = new Date().toISOString();
  await saveTodos(todos);
  return `Completed: "${todo.text}"`;
}

export async function deleteTodo(id: string): Promise<string> {
  const todos = await loadTodos();
  const idx = todos.findIndex((t) => t.id === id);
  if (idx === -1) return `Todo #${id} not found.`;
  const removed = todos.splice(idx, 1)[0];
  await saveTodos(todos);
  return `Deleted: "${removed.text}"`;
}
