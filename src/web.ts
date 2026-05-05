// BlackWhite — MCP DevKit
import { promises as fs, constants } from "fs";
import path from "path";

interface FetchOptions {
  url: string;
  timeout?: number;
  followRedirects?: number;
  extractLinks?: boolean;
  extractMetadata?: boolean;
  extractForms?: boolean;
  cssSelector?: string;
}

interface ParsedHtml {
  title?: string;
  description?: string;
  links: Array<{ text: string; href: string }>;
  forms: Array<{ action: string; method: string; inputs: Array<{ name: string; type: string }> }>;
  metadata: Record<string, string>;
  structuredContent: Record<string, string[]>;
}

function parseHtml(html: string): ParsedHtml {
  const result: ParsedHtml = {
    links: [],
    forms: [],
    metadata: {},
    structuredContent: {},
  };

  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (titleMatch) result.title = titleMatch[1].trim();

  // Extract meta tags
  const metaMatches = [...html.matchAll(/<meta[^>]*(?:name|property)="([^"]*)"[^>]*content="([^"]*)"[^>]*>/gi)];
  for (const match of metaMatches) {
    result.metadata[match[1]] = match[2];
  }
  
  // Extract description
  const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i);
  if (descMatch) result.description = descMatch[1];

  // Extract links
  const linkMatches = [...html.matchAll(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi)];
  for (const match of linkMatches) {
    result.links.push({ text: match[2].trim(), href: match[1] });
  }

  // Extract forms
  const formMatches = [...html.matchAll(/<form[^>]*(?:action="([^"]*)"|method="([^"]*)"|id="([^"]*)")?[^>]*>/gi)];
  for (const match of formMatches) {
    const formStart = html.indexOf(match[0]);
    const formEnd = html.indexOf("</form>", formStart) + 7;
    const formHtml = html.slice(formStart, formEnd);
    
    const inputs: Array<{ name: string; type: string }> = [];
    const inputMatches = [...formHtml.matchAll(/<input[^>]*(?:name="([^"]*)"|type="([^"]*)")?[^>]*>/gi)];
    for (const input of inputMatches) {
      inputs.push({ name: input[1] || "unnamed", type: input[2] || "text" });
    }
    
    result.forms.push({
      action: match[1] || "",
      method: (match[2] || "GET").toUpperCase(),
      inputs,
    });
  }

  // Extract headings for structure
  for (const level of [1, 2, 3, 4, 5, 6]) {
    const headings = [...html.matchAll(new RegExp(`<h${level}[^>]*>([^<]*)</h${level}>`, "gi"))];
    if (headings.length > 0) {
      result.structuredContent[`h${level}`] = headings.map(h => h[1].trim());
    }
  }

  return result;
}

export async function fetchText(url: string, timeout = 30000): Promise<string> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "MCP-DevKit/1.0 (fetch-text)",
        Accept: "text/html,text/plain,application/json",
      },
    });
    clearTimeout(timer);

    if (!response.ok) {
      return `Error: HTTP ${response.status} ${response.statusText}`;
    }

    const contentType = response.headers.get("content-type") || "";
    let body: string;

    if (contentType.includes("application/json")) {
      body = JSON.stringify(await response.json(), null, 2);
    } else {
      body = await response.text();
    }

    // Strip HTML tags if HTML
    if (contentType.includes("text/html")) {
      body = body
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    return body.slice(0, 50000) + (body.length > 50000 ? "\n... (truncated)" : "");
  } catch (err: any) {
    if (err.name === "AbortError") return "Error: Request timed out";
    return `Error: ${err.message}`;
  }
}

export async function fetchStructured(url: string, options: Omit<FetchOptions, "url"> = {}): Promise<string> {
  const { timeout = 30000, followRedirects = 3, extractLinks = true, extractMetadata = true, extractForms = true, cssSelector } = options;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "MCP-DevKit/1.0 (structured-fetch)",
        Accept: "text/html,application/json",
      },
      redirect: followRedirects > 0 ? "follow" : "manual",
    });
    clearTimeout(timer);

    if (!response.ok) {
      return JSON.stringify({ error: `HTTP ${response.status} ${response.statusText}` }, null, 2);
    }

    const contentType = response.headers.get("content-type") || "";
    const body = await response.text();
    const result: any = {
      url,
      status: response.status,
      contentType,
      size: body.length,
    };

    if (contentType.includes("text/html")) {
      const parsed = parseHtml(body);
      if (extractMetadata) {
        result.title = parsed.title;
        result.description = parsed.description;
        result.metadata = parsed.metadata;
      }
      if (extractLinks) {
        result.links = parsed.links.slice(0, 100);
        result.linkCount = parsed.links.length;
      }
      if (extractForms) {
        result.forms = parsed.forms;
      }
      result.structure = parsed.structuredContent;
      
      // If CSS selector provided, extract matching elements (basic implementation)
      if (cssSelector) {
        const selector = cssSelector.replace(/\./, "");
        const classMatches = [...body.matchAll(new RegExp(`class="[^"]*${selector}[^"]*"`, "gi"))];
        result.selectorMatches = classMatches.length;
      }
    } else if (contentType.includes("application/json")) {
      result.json = JSON.parse(body);
    } else {
      result.text = body.slice(0, 10000);
    }

    result.redirects = followRedirects;
    result.truncated = body.length > 50000;

    return JSON.stringify(result, null, 2);
  } catch (err: any) {
    if (err.name === "AbortError") return JSON.stringify({ error: "Request timed out" }, null, 2);
    return JSON.stringify({ error: err.message }, null, 2);
  }
}

export async function extractLinks(url: string, timeout = 30000): Promise<string> {
  const result = await fetchStructured(url, { timeout, extractLinks: true, extractMetadata: false, extractForms: false });
  const parsed = JSON.parse(result);
  if (parsed.error) return result;
  return JSON.stringify({
    url,
    links: parsed.links || [],
    count: parsed.linkCount || 0,
  }, null, 2);
}

export async function extractForms(url: string, timeout = 30000): Promise<string> {
  const result = await fetchStructured(url, { timeout, extractLinks: false, extractMetadata: false, extractForms: true });
  const parsed = JSON.parse(result);
  if (parsed.error) return result;
  return JSON.stringify({
    url,
    forms: parsed.forms || [],
    count: (parsed.forms || []).length,
  }, null, 2);
}

export async function fetchJson(url: string, timeout = 30000): Promise<string> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": "MCP-DevKit/1.0" },
    });
    clearTimeout(timer);

    if (!response.ok) {
      return JSON.stringify({ error: `HTTP ${response.status} ${response.statusText}` }, null, 2);
    }

    const body = await response.json();
    return JSON.stringify(body, null, 2).slice(0, 50000);
  } catch (err: any) {
    if (err.name === "AbortError") return JSON.stringify({ error: "Request timed out" }, null, 2);
    return JSON.stringify({ error: err.message }, null, 2);
  }
}

interface FileInfo {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  modified?: string;
}

export async function getFileInfo(filePath: string): Promise<string> {
  const full = path.resolve(filePath);
  try {
    await fs.access(full, constants.R_OK);
    const stat = await fs.stat(full);
    const info = {
      path: full,
      name: path.basename(full),
      type: stat.isDirectory() ? "directory" : "file",
      size: stat.size,
      created: stat.birthtime.toISOString(),
      modified: stat.mtime.toISOString(),
      accessed: stat.atime.toISOString(),
      permissions: stat.mode.toString(8),
      isSymbolicLink: stat.isSymbolicLink(),
    };
    return JSON.stringify(info, null, 2);
  } catch (err: any) {
    return `Error: ${err.message}`;
  }
}

export async function directoryTree(dirPath: string, maxDepth = 3): Promise<string> {
  const root = path.resolve(dirPath);

  async function walk(dir: string, depth: number, prefix: string): Promise<string[]> {
    if (depth > maxDepth) return [];
    let entries: string[];
    try {
      await fs.access(dir, constants.R_OK);
      entries = await fs.readdir(dir);
    } catch {
      return [];
    }

    const lines: string[] = [];
    const filtered = entries
      .filter((e) => !e.startsWith(".") && e !== "node_modules" && e !== "dist" && e !== "build")
      .sort((a, b) => a.localeCompare(b));

    for (let i = 0; i < filtered.length; i++) {
      const name = filtered[i];
      const isLast = i === filtered.length - 1;
      const full = path.join(dir, name);
      const connector = isLast ? "└── " : "├── ";
      const childPrefix = isLast ? "    " : "│   ";

      try {
        const stat = await fs.stat(full);
        if (stat.isDirectory()) {
          lines.push(`${prefix}${connector}${name}/`);
          lines.push(...(await walk(full, depth + 1, prefix + childPrefix)));
        } else {
          lines.push(`${prefix}${connector}${name} (${stat.size} bytes)`);
        }
      } catch {
        // ignore
      }
    }
    return lines;
  }

  const lines = await walk(root, 0, "");
  return [`${root}/`, ...lines].join("\n");
}
