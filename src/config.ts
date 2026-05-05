// BlackWhite — MCP DevKit
import { promises as fs } from "fs";
import path from "path";
import os from "os";

interface ConfigSection {
  [key: string]: unknown;
}

interface ConfigData {
  [section: string]: ConfigSection;
}

const CONFIG_FILE = path.join(os.homedir(), ".mcp-devkit", "config.json");

const DEFAULT_CONFIG: ConfigData = {
  preferences: {
    defaultShell: process.platform === "win32" ? "powershell" : "bash",
    defaultEditor: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    dateFormat: "ISO",
  },
  memory: {
    autoPrune: false,
    pruneThreshold: 200,
    autoConsolidate: false,
    maxMemories: 500,
  },
  http: {
    defaultTimeout: 30000,
    defaultRetryCount: 3,
    defaultCache: false,
    userAgent: "MCP-DevKit/1.0",
  },
  git: {
    autoFetch: false,
    defaultRemote: "origin",
    conventionalCommits: true,
  },
  snippets: {
    defaultLanguage: "typescript",
    autoDetectLanguage: true,
  },
  templates: {
    customPath: "",
    autoBackup: true,
  },
  ui: {
    compactOutput: false,
    showTimestamps: true,
    colorizeOutput: true,
  },
};

async function loadConfig(): Promise<ConfigData> {
  try {
    const data = await fs.readFile(CONFIG_FILE, "utf-8");
    const parsed = JSON.parse(data) as ConfigData;
    // Merge with defaults to ensure all keys exist
    return deepMerge(DEFAULT_CONFIG, parsed);
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }
}

async function saveConfig(config: ConfigData) {
  await fs.mkdir(path.dirname(CONFIG_FILE), { recursive: true });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

function deepMerge(base: ConfigData, override: ConfigData): ConfigData {
  const result: ConfigData = JSON.parse(JSON.stringify(base));
  for (const [section, values] of Object.entries(override)) {
    if (typeof values === "object" && values !== null && !Array.isArray(values)) {
      result[section] = { ...(result[section] || {}), ...(values as ConfigSection) };
    } else {
      result[section] = values as ConfigSection;
    }
  }
  return result;
}

export async function getConfig(section?: string, key?: string): Promise<string> {
  const config = await loadConfig();

  if (!section) {
    return JSON.stringify(config, null, 2);
  }

  const sec = config[section];
  if (!sec) {
    return `Section "${section}" not found in config. Available sections: ${Object.keys(config).join(", ")}.`;
  }

  if (!key) {
    return JSON.stringify(sec, null, 2);
  }

  if (!(key in sec)) {
    return `Key "${key}" not found in section "${section}". Available keys: ${Object.keys(sec).join(", ")}.`;
  }

  const value = sec[key];
  return `${section}.${key} = ${JSON.stringify(value, null, 2)}`;
}

export async function setConfig(section: string, key: string, value: string): Promise<string> {
  const config = await loadConfig();

  if (!config[section]) {
    config[section] = {};
  }

  // Try to parse as JSON first, fallback to string
  let parsedValue: unknown = value;
  try {
    parsedValue = JSON.parse(value);
  } catch {
    // Keep as string
  }

  config[section][key] = parsedValue;
  await saveConfig(config);

  return `Set ${section}.${key} = ${JSON.stringify(parsedValue)}`;
}

export async function resetConfig(section?: string): Promise<string> {
  if (section) {
    const config = await loadConfig();
    if (DEFAULT_CONFIG[section]) {
      config[section] = JSON.parse(JSON.stringify(DEFAULT_CONFIG[section]));
      await saveConfig(config);
      return `Reset section "${section}" to defaults.`;
    }
    return `Section "${section}" has no defaults. Available: ${Object.keys(DEFAULT_CONFIG).join(", ")}.`;
  }

  await saveConfig(JSON.parse(JSON.stringify(DEFAULT_CONFIG)));
  return "Reset all config to defaults.";
}

export async function listConfigSections(): Promise<string> {
  const config = await loadConfig();
  const lines: string[] = ["# Config Sections", ""];
  for (const [section, values] of Object.entries(config)) {
    const keys = Object.keys(values);
    lines.push(`## ${section} (${keys.length} keys)`);
    for (const key of keys) {
      const val = JSON.stringify(values[key]);
      lines.push(`  ${key}: ${val.length > 60 ? val.slice(0, 60) + "..." : val}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export async function deleteConfigKey(section: string, key: string): Promise<string> {
  const config = await loadConfig();
  if (!config[section]) {
    return `Section "${section}" not found.`;
  }
  if (!(key in config[section])) {
    return `Key "${key}" not found in section "${section}".`;
  }

  delete config[section][key];
  await saveConfig(config);
  return `Deleted ${section}.${key}.`;
}

export async function exportConfig(exportPath?: string): Promise<string> {
  const config = await loadConfig();
  const targetPath = exportPath || path.join(os.homedir(), ".mcp-devkit", "config-export.json");
  await fs.writeFile(targetPath, JSON.stringify(config, null, 2), "utf-8");
  return `Exported config to ${targetPath}.`;
}

export async function importConfig(importPath: string): Promise<string> {
  try {
    const raw = await fs.readFile(path.resolve(importPath), "utf-8");
    const imported = JSON.parse(raw) as ConfigData;
    const merged = deepMerge(await loadConfig(), imported);
    await saveConfig(merged);
    return `Imported config from ${importPath}. Sections: ${Object.keys(imported).join(", ")}.`;
  } catch (err) {
    return `Import failed: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// Internal helper for other modules to read config values
export async function getConfigValue<T>(section: string, key: string, defaultValue: T): Promise<T> {
  try {
    const config = await loadConfig();
    const val = config[section]?.[key];
    return val !== undefined ? (val as T) : defaultValue;
  } catch {
    return defaultValue;
  }
}
