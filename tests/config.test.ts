import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import {
  getConfig,
  setConfig,
  resetConfig,
  listConfigSections,
  deleteConfigKey,
  exportConfig,
  importConfig,
} from "../src/config.js";

const CONFIG_FILE = path.join(os.homedir(), ".mcp-devkit", "config.json");

async function resetConfigFile() {
  try {
    await fs.unlink(CONFIG_FILE);
  } catch {
    // ignore
  }
}

describe("Config", () => {
  beforeEach(resetConfigFile);
  afterEach(resetConfigFile);

  it("sets and gets a config value", async () => {
    const setResult = await setConfig("preferences", "defaultShell", "bash");
    expect(setResult).toContain("Set preferences.defaultShell");
    expect(setResult).toContain("bash");

    const getResult = await getConfig("preferences", "defaultShell");
    expect(getResult).toContain("bash");
  });

  it("parses JSON values automatically", async () => {
    await setConfig("preferences", "testNumber", "42");
    const result = await getConfig("preferences", "testNumber");
    expect(result).toContain("42");
  });

  it("returns all config when no section specified", async () => {
    const result = await getConfig();
    expect(result).toContain("preferences");
    expect(result).toContain("memory");
    expect(result).toContain("http");
  });

  it("lists config sections", async () => {
    const result = await listConfigSections();
    expect(result).toContain("preferences");
    expect(result).toContain("memory");
  });

  it("deletes a config key", async () => {
    await setConfig("preferences", "tempKey", "tempValue");
    const delResult = await deleteConfigKey("preferences", "tempKey");
    expect(delResult).toContain("Deleted");

    const getResult = await getConfig("preferences", "tempKey");
    expect(getResult).toContain("not found");
  });

  it("exports and imports config", async () => {
    await setConfig("preferences", "testKey", "testValue");
    const exportPath = path.join(os.tmpdir(), `config-export-${Date.now()}.json`);

    const exportResult = await exportConfig(exportPath);
    expect(exportResult).toContain("Exported");

    await resetConfigFile();

    const importResult = await importConfig(exportPath);
    expect(importResult).toContain("Imported");

    const getResult = await getConfig("preferences", "testKey");
    expect(getResult).toContain("testValue");

    await fs.unlink(exportPath).catch(() => {});
  });

  it("resets config to defaults", async () => {
    await setConfig("preferences", "defaultShell", "zsh");
    const resetResult = await resetConfig("preferences");
    expect(resetResult).toContain("Reset");

    const getResult = await getConfig("preferences", "defaultShell");
    // After reset it should have the platform-dependent default
    expect(getResult).toMatch(/bash|powershell|cmd/);
  });
});
