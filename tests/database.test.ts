// BlackWhite — MCP DevKit
import { describe, it, expect } from "vitest";
import {
  dbSet, dbGet, dbDelete, dbList, dbQuery,
} from "../src/database.js";

const TEST_STORE = "test-store-vitest";

describe("database", () => {
  it("sets and gets a value", async () => {
    await dbSet(TEST_STORE, "key1", JSON.stringify({ foo: "bar" }));
    const result = await dbGet(TEST_STORE, "key1");
    const parsed = JSON.parse(result);
    expect(parsed.value).toEqual({ foo: "bar" });
  });

  it("stores plain string values", async () => {
    await dbSet(TEST_STORE, "key2", "hello world");
    const result = await dbGet(TEST_STORE, "key2");
    const parsed = JSON.parse(result);
    expect(parsed.value).toBe("hello world");
  });

  it("returns not found for missing key", async () => {
    const result = await dbGet(TEST_STORE, "missing-key-xyz");
    expect(result).toContain("not found");
  });

  it("deletes a key", async () => {
    await dbSet(TEST_STORE, "del-key", "value");
    const delResult = await dbDelete(TEST_STORE, "del-key");
    expect(delResult).toContain("Deleted");
    const getResult = await dbGet(TEST_STORE, "del-key");
    expect(getResult).toContain("not found");
  });

  it("lists keys", async () => {
    await dbSet(TEST_STORE, "list-a", "1");
    await dbSet(TEST_STORE, "list-b", "2");
    const result = await dbList(TEST_STORE);
    const parsed = JSON.parse(result);
    expect(parsed.keys).toContain("list-a");
    expect(parsed.keys).toContain("list-b");
  });

  it("filters list by prefix", async () => {
    await dbSet(TEST_STORE, "pref-1", "1");
    await dbSet(TEST_STORE, "pref-2", "2");
    await dbSet(TEST_STORE, "other", "3");
    const result = await dbList(TEST_STORE, "pref-");
    const parsed = JSON.parse(result);
    expect(parsed.keys).toContain("pref-1");
    expect(parsed.keys).toContain("pref-2");
    expect(parsed.keys).not.toContain("other");
  });

  it("queries by substring", async () => {
    await dbSet(TEST_STORE, "q1", JSON.stringify({ name: "Alice", age: 30 }));
    await dbSet(TEST_STORE, "q2", JSON.stringify({ name: "Bob", age: 25 }));
    const result = await dbQuery(TEST_STORE, "Alice");
    const parsed = JSON.parse(result);
    expect(parsed.matches.length).toBe(1);
    expect(parsed.matches[0]).toBe("q1");
  });

  it("returns empty query results when no match", async () => {
    const result = await dbQuery(TEST_STORE, "zzzzzz-no-match");
    const parsed = JSON.parse(result);
    expect(parsed.matches).toEqual([]);
  });
});
