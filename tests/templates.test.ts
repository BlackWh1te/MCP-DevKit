import { describe, it, expect } from "vitest";
import {
  listTemplates,
  getTemplate,
  renderTemplateFile,
  createTemplate,
  deleteTemplate,
  searchTemplates,
} from "../src/templates.js";

describe("Templates", () => {
  it("lists built-in templates", async () => {
    const result = await listTemplates();
    expect(result).toContain("React Component");
    expect(result).toContain("Test File");
    expect(result).toContain("React Custom Hook");
  });

  it("filters templates by category", async () => {
    const result = await listTemplates("react");
    expect(result).toContain("React Component");
    expect(result).not.toContain("GitHub Action Workflow");
  });

  it("gets a template by id", async () => {
    const result = await getTemplate("react-component");
    expect(result).toContain("React Component");
    expect(result).toContain("{{ComponentName}}");
  });

  it("returns not found for unknown template", async () => {
    const result = await getTemplate("nonexistent-template-id");
    expect(result).toContain("not found");
  });

  it("renders a template with variables", async () => {
    const result = await renderTemplateFile("react-component", { ComponentName: "MyButton" });
    expect(result).toContain("MyButtonProps");
    expect(result).toContain("function MyButton");
  });

  it("reports missing variables", async () => {
    const result = await renderTemplateFile("test-file", {});
    expect(result).toContain("Missing required variables");
  });

  it("creates a custom template", async () => {
    const result = await createTemplate(
      "My Custom Template",
      "Hello {{Name}}!",
      "text",
      "custom",
      "A custom greeting template",
      ["Name"],
      ["custom", "greeting"],
    );
    expect(result).toContain("Created template");
    expect(result).toContain("My Custom Template");

    const list = await listTemplates("custom");
    expect(list).toContain("My Custom Template");
  });

  it("deletes a custom template", async () => {
    const createResult = await createTemplate("Delete me", "content", "text", "test");
    const idMatch = createResult.match(/#([a-z0-9]+)/);
    const id = idMatch ? idMatch[1] : "";

    const deleteResult = await deleteTemplate(id);
    expect(deleteResult).toContain("Deleted");
  });

  it("cannot delete built-in templates", async () => {
    const result = await deleteTemplate("react-component");
    expect(result).toContain("Cannot delete built-in");
  });

  it("searches templates by query", async () => {
    const result = await searchTemplates("react");
    expect(result).toContain("React");
  });

  it("returns no results for unknown search", async () => {
    const result = await searchTemplates("zzzznonexistent123");
    expect(result).toContain("No templates found");
  });
});
