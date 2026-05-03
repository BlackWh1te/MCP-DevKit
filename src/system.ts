// BlackWhite — MCP DevKit
import os from "os";
import { createServer } from "net";

export function getSystemInfo(): string {
  const info = {
    platform: os.platform(),
    arch: os.arch(),
    release: os.release(),
    hostname: os.hostname(),
    nodeVersion: process.version,
    cwd: process.cwd(),
    totalMemory: `${Math.round(os.totalmem() / 1024 / 1024)} MB`,
    freeMemory: `${Math.round(os.freemem() / 1024 / 1024)} MB`,
    cpus: os.cpus().length,
    uptime: `${Math.round(os.uptime() / 3600)} hours`,
    loadAvg: os.loadavg(),
    homeDir: os.homedir(),
    tmpDir: os.tmpdir(),
    envVars: Object.keys(process.env).sort(),
  };
  return JSON.stringify(info, null, 2);
}

export function checkPort(port: number, host = "127.0.0.1"): Promise<string> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", (err: any) => {
      if (err.code === "EADDRINUSE") {
        resolve(
          JSON.stringify(
            {
              port,
              host,
              available: false,
              message: `Port ${port} is in use on ${host}`,
            },
            null,
            2
          )
        );
      } else {
        resolve(
          JSON.stringify(
            {
              port,
              host,
              available: false,
              error: err.message,
            },
            null,
            2
          )
        );
      }
    });
    server.once("listening", () => {
      server.close();
      resolve(
        JSON.stringify(
          {
            port,
            host,
            available: true,
            message: `Port ${port} is available on ${host}`,
          },
          null,
          2
        )
      );
    });
    server.listen(port, host);
  });
}

export async function getEnvFile(filePath = ".env"): Promise<string> {
  const fs = await import("fs/promises");
  const path = await import("path");
  const full = path.default.resolve(filePath);
  try {
    const content = await fs.readFile(full, "utf-8");
    const lines = content.split("\n");
    const env: Record<string, string> = {};
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx);
        const value = trimmed.slice(eqIdx + 1);
        // Mask potential secrets
        const isSecret = /key|secret|token|password|auth|private/i.test(key);
        env[key] = isSecret ? "***REDACTED***" : value;
      }
    }
    return JSON.stringify({ file: full, variables: env }, null, 2);
  } catch (err: any) {
    return `Error reading env file: ${err.message}`;
  }
}
