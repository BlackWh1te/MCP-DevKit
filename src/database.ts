// BlackWhite — MCP DevKit
import { promises as fs } from "fs";
import path from "path";
import os from "os";

const DB_DIR = path.join(os.homedir(), ".mcp-devkit", "db");

async function getDbPath(name: string): Promise<string> {
  await fs.mkdir(DB_DIR, { recursive: true });
  return path.join(DB_DIR, `${name}.json`);
}

async function loadDb(name: string): Promise<Record<string, unknown>> {
  const p = await getDbPath(name);
  try {
    const data = await fs.readFile(p, "utf-8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function saveDb(name: string, data: Record<string, unknown>) {
  const p = await getDbPath(name);
  await fs.writeFile(p, JSON.stringify(data, null, 2), "utf-8");
}

export async function dbSet(store: string, key: string, value: string): Promise<string> {
  const db = await loadDb(store);
  try {
    db[key] = JSON.parse(value);
  } catch {
    db[key] = value;
  }
  await saveDb(store, db);
  return `Set '${key}' in store '${store}'.`;
}

export async function dbGet(store: string, key: string): Promise<string> {
  const db = await loadDb(store);
  if (!(key in db)) return `Key '${key}' not found in store '${store}'.`;
  return JSON.stringify({ store, key, value: db[key] }, null, 2);
}

export async function dbDelete(store: string, key: string): Promise<string> {
  const db = await loadDb(store);
  if (!(key in db)) return `Key '${key}' not found in store '${store}'.`;
  delete db[key];
  await saveDb(store, db);
  return `Deleted '${key}' from store '${store}'.`;
}

export async function dbList(store: string, prefix?: string): Promise<string> {
  const db = await loadDb(store);
  const keys = Object.keys(db).filter((k) => !prefix || k.startsWith(prefix));
  return JSON.stringify({ store, keys, count: keys.length }, null, 2);
}

export async function dbQuery(store: string, query: string): Promise<string> {
  const db = await loadDb(store);
  const results: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(db)) {
    const str = JSON.stringify(v).toLowerCase();
    if (str.includes(query.toLowerCase())) results[k] = v;
  }
  return JSON.stringify({ store, query, matches: Object.keys(results), count: Object.keys(results).length, results }, null, 2);
}
