// BlackWhite — MCP DevKit
import { describe, it, expect, beforeEach } from "vitest";
import { createTodo, listTodos, completeTodo, deleteTodo } from "../src/todos.js";

describe("Todos", () => {
  beforeEach(async () => {
    // Clear todos before each test by deleting all
    try {
      const todosResult = await listTodos();
      const idMatches = todosResult.match(/#(\w+)/g);
      if (idMatches) {
        for (const match of idMatches) {
          const id = match.slice(1);
          await deleteTodo(id);
        }
      }
    } catch {
      // ignore
    }
  });

  describe("createTodo", () => {
    it("should create a new todo", async () => {
      const result = await createTodo("Test todo", "high");
      expect(result).toContain("Created todo");
      expect(result).toContain("Test todo");
      expect(result).toContain("high");
    });

    it("should create todo with default priority", async () => {
      const result = await createTodo("Test todo");
      expect(result).toContain("medium");
    });
  });

  describe("listTodos", () => {
    it("should list all todos", async () => {
      await createTodo("Todo 1", "high");
      await createTodo("Todo 2", "low");
      const result = await listTodos();
      expect(result).toContain("Todos");
      expect(result).toContain("Todo 1");
      expect(result).toContain("Todo 2");
    });

    it("should return message when no todos", async () => {
      const result = await listTodos();
      expect(result).toContain("No todos");
    });
  });

  describe("completeTodo", () => {
    it("should mark todo as completed", async () => {
      const createResult = await createTodo("Test todo");
      const id = createResult.match(/#(\w+)/)?.[1];
      if (id) {
        const result = await completeTodo(id);
        expect(result).toContain("Completed");
      }
    });

    it("should handle non-existent todo", async () => {
      const result = await completeTodo("nonexistent");
      expect(result).toContain("not found");
    });
  });

  describe("deleteTodo", () => {
    it("should delete a todo", async () => {
      const createResult = await createTodo("Test todo");
      const id = createResult.match(/#(\w+)/)?.[1];
      if (id) {
        const result = await deleteTodo(id);
        expect(result).toContain("Deleted");
      }
    });

    it("should handle non-existent todo", async () => {
      const result = await deleteTodo("nonexistent");
      expect(result).toContain("not found");
    });
  });
});
