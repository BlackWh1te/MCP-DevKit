// BlackWhite — MCP DevKit
import { promises as fs } from "fs";
import path from "path";
import os from "os";

interface Template {
  id: string;
  name: string;
  description: string;
  language: string;
  category: string;
  content: string;
  variables: string[];
  tags: string[];
  createdAt: string;
  usageCount: number;
}

const TEMPLATES_FILE = path.join(os.homedir(), ".mcp-devkit", "templates.json");

const BUILT_IN_TEMPLATES: Record<string, Template> = {
  "react-component": {
    id: "react-component",
    name: "React Component",
    description: "TypeScript React functional component with props interface",
    language: "typescript",
    category: "react",
    content: `import React from "react";

interface {{ComponentName}}Props {
  // Add props here
}

export function {{ComponentName}}(props: {{ComponentName}}Props) {
  return (
    <div>
      {/* {{ComponentName}} content */}
    </div>
  );
}`,
    variables: ["ComponentName"],
    tags: ["react", "typescript", "component"],
    createdAt: new Date().toISOString(),
    usageCount: 0,
  },
  "react-hook": {
    id: "react-hook",
    name: "React Custom Hook",
    description: "TypeScript custom React hook with useEffect and cleanup",
    language: "typescript",
    category: "react",
    content: `import { useState, useEffect } from "react";

export function use{{HookName}}() {
  const [state, setState] = useState(null);

  useEffect(() => {
    // Effect logic
    return () => {
      // Cleanup
    };
  }, []);

  return { state, setState };
}`,
    variables: ["HookName"],
    tags: ["react", "typescript", "hook"],
    createdAt: new Date().toISOString(),
    usageCount: 0,
  },
  "api-route": {
    id: "api-route",
    name: "API Route Handler",
    description: "Express/Fastify-style API route with error handling",
    language: "typescript",
    category: "backend",
    content: `import { Request, Response } from "express";

export async function {{RouteName}}Handler(req: Request, res: Response) {
  try {
    // Handler logic
    res.json({ success: true, data: null });
  } catch (error) {
    console.error("Error in {{RouteName}}:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}`,
    variables: ["RouteName"],
    tags: ["api", "backend", "express"],
    createdAt: new Date().toISOString(),
    usageCount: 0,
  },
  "test-file": {
    id: "test-file",
    name: "Test File",
    description: "Vitest/Jest test file with describe/it/expect pattern",
    language: "typescript",
    category: "testing",
    content: `import { describe, it, expect } from "vitest";
import { {{FunctionName}} } from "./{{ModuleName}}";

describe("{{FunctionName}}", () => {
  it("should work correctly", () => {
    const result = {{FunctionName}}();
    expect(result).toBeDefined();
  });
});`,
    variables: ["FunctionName", "ModuleName"],
    tags: ["test", "vitest", "jest"],
    createdAt: new Date().toISOString(),
    usageCount: 0,
  },
  "python-function": {
    id: "python-function",
    name: "Python Function",
    description: "Python function with type hints and docstring",
    language: "python",
    category: "python",
    content: `def {{FunctionName}}(param: str) -> str:
    """
    {{Description}}

    Args:
        param: Description of param

    Returns:
        Description of return value
    """
    return param`,
    variables: ["FunctionName", "Description"],
    tags: ["python", "function"],
    createdAt: new Date().toISOString(),
    usageCount: 0,
  },
  "rust-struct": {
    id: "rust-struct",
    name: "Rust Struct + Impl",
    description: "Rust struct with derived traits and implementation block",
    language: "rust",
    category: "rust",
    content: `#[derive(Debug, Clone)]
pub struct {{StructName}} {
    field: String,
}

impl {{StructName}} {
    pub fn new(field: String) -> Self {
        Self { field }
    }

    pub fn field(&self) -> &str {
        &self.field
    }
}`,
    variables: ["StructName"],
    tags: ["rust", "struct"],
    createdAt: new Date().toISOString(),
    usageCount: 0,
  },
  "go-handler": {
    id: "go-handler",
    name: "Go HTTP Handler",
    description: "Go HTTP handler function with standard net/http",
    language: "go",
    category: "go",
    content: `package main

import (
    "encoding/json"
    "net/http"
)

func {{HandlerName}}(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    response := map[string]interface{}{
        "status": "ok",
    }
    json.NewEncoder(w).Encode(response)
}`,
    variables: ["HandlerName"],
    tags: ["go", "http", "handler"],
    createdAt: new Date().toISOString(),
    usageCount: 0,
  },
  "sql-table": {
    id: "sql-table",
    name: "SQL Table Definition",
    description: "PostgreSQL table with timestamps and indexes",
    language: "sql",
    category: "database",
    content: `CREATE TABLE IF NOT EXISTS {{TableName}} (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_{{TableName}}_created_at ON {{TableName}}(created_at);`,
    variables: ["TableName"],
    tags: ["sql", "postgres", "database"],
    createdAt: new Date().toISOString(),
    usageCount: 0,
  },
  dockerfile: {
    id: "dockerfile",
    name: "Node.js Dockerfile",
    description: "Multi-stage Dockerfile for Node.js app",
    language: "dockerfile",
    category: "devops",
    content: `FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]`,
    variables: [],
    tags: ["docker", "nodejs", "devops"],
    createdAt: new Date().toISOString(),
    usageCount: 0,
  },
  "github-action": {
    id: "github-action",
    name: "GitHub Action Workflow",
    description: "CI workflow with test, lint, and build steps",
    language: "yaml",
    category: "devops",
    content: `name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build`,
    variables: [],
    tags: ["github", "ci", "devops"],
    createdAt: new Date().toISOString(),
    usageCount: 0,
  },
  readme: {
    id: "readme",
    name: "README.md",
    description: "Standard README with sections for description, install, usage, and license",
    language: "markdown",
    category: "documentation",
    content: `# {{ProjectName}}

> {{Description}}

## Installation

\`\`\`bash
npm install {{ProjectName}}
\`\`\`

## Usage

\`\`\`typescript
import { something } from "{{ProjectName}}";
\`\`\`

## License

MIT`,
    variables: ["ProjectName", "Description"],
    tags: ["markdown", "docs", "readme"],
    createdAt: new Date().toISOString(),
    usageCount: 0,
  },
};

async function loadTemplates(): Promise<Record<string, Template>> {
  try {
    const data = await fs.readFile(TEMPLATES_FILE, "utf-8");
    const userTemplates = JSON.parse(data) as Record<string, Template>;
    return { ...BUILT_IN_TEMPLATES, ...userTemplates };
  } catch {
    return { ...BUILT_IN_TEMPLATES };
  }
}

async function saveUserTemplates(templates: Record<string, Template>) {
  await fs.mkdir(path.dirname(TEMPLATES_FILE), { recursive: true });
  // Only save user-created templates (not built-in)
  const userTemplates: Record<string, Template> = {};
  for (const [id, t] of Object.entries(templates)) {
    if (!BUILT_IN_TEMPLATES[id]) {
      userTemplates[id] = t;
    }
  }
  await fs.writeFile(TEMPLATES_FILE, JSON.stringify(userTemplates, null, 2), "utf-8");
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function renderTemplate(template: Template, variables: Record<string, string>): string {
  let result = template.content;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}

function findMissingVariables(template: Template, variables: Record<string, string>): string[] {
  return template.variables.filter((v) => !variables[v]);
}

export async function listTemplates(category?: string, language?: string): Promise<string> {
  const templates = await loadTemplates();
  let items = Object.values(templates);

  if (category) {
    items = items.filter((t) => t.category.toLowerCase() === category.toLowerCase());
  }
  if (language) {
    items = items.filter((t) => t.language.toLowerCase() === language.toLowerCase());
  }

  if (items.length === 0) {
    const filters = [category ? `category:${category}` : "", language ? `language:${language}` : ""]
      .filter(Boolean)
      .join(" and ");
    return filters ? `No templates with ${filters}.` : "No templates available.";
  }

  const lines: string[] = [`Templates (${items.length}):`, ""];
  for (const t of items.sort((a, b) => b.usageCount - a.usageCount)) {
    const builtin = BUILT_IN_TEMPLATES[t.id] ? " [built-in]" : "";
    lines.push(`- ${t.name} (#${t.id}) [${t.language}] [${t.category}]${builtin}`);
    lines.push(`  ${t.description}`);
    if (t.variables.length) lines.push(`  Variables: ${t.variables.join(", ")}`);
    lines.push("");
  }
  return lines.join("\n");
}

export async function getTemplate(id: string): Promise<string> {
  const templates = await loadTemplates();
  const t = templates[id];
  if (!t) return `Template #${id} not found.`;

  const lines = [
    `## ${t.name} (#${t.id})`,
    `Category: ${t.category} | Language: ${t.language}`,
    `Description: ${t.description}`,
    t.variables.length ? `Variables: ${t.variables.join(", ")}` : "No variables",
    `Tags: ${t.tags.join(", ")}`,
    t.usageCount > 0 ? `Used ${t.usageCount} times` : "Never used",
    "",
    "```" + t.language,
    t.content,
    "```",
  ];
  return lines.join("\n");
}

export async function renderTemplateFile(
  id: string,
  variables: Record<string, string>,
  outputPath?: string,
): Promise<string> {
  const templates = await loadTemplates();
  const t = templates[id];
  if (!t) return `Template #${id} not found.`;

  const missing = findMissingVariables(t, variables);
  if (missing.length > 0) {
    return `Missing required variables: ${missing.join(", ")}`;
  }

  const rendered = renderTemplate(t, variables);

  t.usageCount++;
  if (!BUILT_IN_TEMPLATES[id]) {
    await saveUserTemplates(templates);
  } else {
    // Save usage count for built-in templates separately if needed
    await saveUserTemplates(templates);
  }

  if (outputPath) {
    await fs.mkdir(path.dirname(path.resolve(outputPath)), { recursive: true });
    await fs.writeFile(outputPath, rendered, "utf-8");
    return `Rendered template "${t.name}" to ${outputPath}.\n\n${rendered.length} characters written.`;
  }

  return `Rendered template "${t.name}":\n\n\`\`\`${t.language}\n${rendered}\n\`\`\``;
}

export async function createTemplate(
  name: string,
  content: string,
  language: string,
  category: string,
  description?: string,
  variables: string[] = [],
  tags: string[] = [],
): Promise<string> {
  const templates = await loadTemplates();
  const id = generateId();
  const now = new Date().toISOString();

  const template: Template = {
    id,
    name,
    content,
    language,
    category,
    description: description || name,
    variables,
    tags,
    createdAt: now,
    usageCount: 0,
  };

  templates[id] = template;
  await saveUserTemplates(templates);

  return `Created template "${name}" (#${id}) [${language}] [${category}] with variables: ${variables.join(", ") || "none"}.`;
}

export async function deleteTemplate(id: string): Promise<string> {
  if (BUILT_IN_TEMPLATES[id]) {
    return `Cannot delete built-in template #${id}. You can override it by creating a custom template with the same name.`;
  }
  const templates = await loadTemplates();
  if (!templates[id]) return `Template #${id} not found.`;
  const name = templates[id].name;
  delete templates[id];
  await saveUserTemplates(templates);
  return `Deleted template "${name}" (#${id}).`;
}

export async function searchTemplates(query: string): Promise<string> {
  const templates = await loadTemplates();
  const q = query.toLowerCase();
  const results = Object.values(templates).filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      t.language.toLowerCase().includes(q) ||
      t.tags.some((tag) => tag.toLowerCase().includes(q)),
  );

  if (results.length === 0) {
    return `No templates found for "${query}".`;
  }

  const lines: string[] = [`Found ${results.length} template(s) for "${query}":`, ""];
  for (const t of results) {
    lines.push(`- ${t.name} (#${t.id}) [${t.language}] [${t.category}] — ${t.description}`);
  }
  return lines.join("\n");
}
