// BlackWhite — MCP DevKit
import os from "os";
import { createServer } from "net";
import { promises as fs } from "fs";
import path from "path";

export function getSystemInfo(): string {
  const cpus = os.cpus();
  const networkInterfaces = os.networkInterfaces();
  
  // Format network interfaces
  const formattedNetworks: Record<string, Array<{ address: string; netmask: string; family: string; internal: boolean }>> = {};
  for (const [name, interfaces] of Object.entries(networkInterfaces)) {
    if (interfaces) {
      formattedNetworks[name] = interfaces.map(iface => ({
        address: iface.address,
        netmask: iface.netmask,
        family: iface.family,
        internal: iface.internal,
      }));
    }
  }
  
  const info = {
    platform: os.platform(),
    platformType: os.type(),
    arch: os.arch(),
    release: os.release(),
    hostname: os.hostname(),
    nodeVersion: process.version,
    cwd: process.cwd(),
    memory: {
      total: `${Math.round(os.totalmem() / 1024 / 1024 / 1024 * 100) / 100} GB`,
      free: `${Math.round(os.freemem() / 1024 / 1024 / 1024 * 100) / 100} GB`,
      used: `${Math.round((os.totalmem() - os.freemem()) / 1024 / 1024 / 1024 * 100) / 100} GB`,
      usagePercent: `${Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100)}%`,
    },
    cpu: {
      count: cpus.length,
      model: cpus[0]?.model || "Unknown",
      speed: `${cpus[0]?.speed || 0} MHz`,
    },
    uptime: {
      total: `${Math.round(os.uptime() / 3600)} hours`,
      system: `${Math.round(os.uptime() / 60)} minutes`,
    },
    loadAverage: os.loadavg().map(load => load.toFixed(2)),
    homeDir: os.homedir(),
    tmpDir: os.tmpdir(),
    networkInterfaces: formattedNetworks,
    envVars: {
      count: Object.keys(process.env).length,
      keys: Object.keys(process.env).sort(),
    },
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
  const full = path.resolve(filePath);
  try {
    const content = await fs.readFile(full, "utf-8");
    const lines = content.split("\n");
    const env: Record<string, string> = {};
    const secrets: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx);
        const value = trimmed.slice(eqIdx + 1);
        // Mask potential secrets
        const isSecret = /key|secret|token|password|auth|private/i.test(key);
        if (isSecret) secrets.push(key);
        env[key] = isSecret ? "***REDACTED***" : value;
      }
    }
    return JSON.stringify({ 
      file: full, 
      variables: env,
      secretsDetected: secrets,
      secretCount: secrets.length,
    }, null, 2);
  } catch (err: any) {
    return `Error reading env file: ${err.message}`;
  }
}

export async function getDiskUsage(dirPath?: string): Promise<string> {
  const platform = os.platform();
  const targetDir = dirPath || process.cwd();
  
  try {
    if (platform === "win32") {
      // Windows: use wmic
      const { spawn } = await import("child_process");
      return new Promise((resolve) => {
        const child = spawn("wmic", ["logicaldisk", "get", "size,freespace,caption"]);
        let output = "";
        child.stdout?.on("data", (data: Buffer) => {
          output += data.toString();
        });
        child.on("close", () => {
          const lines = output.split("\n").filter((l: string) => l.trim());
          const disks: any[] = [];
          for (const line of lines.slice(1)) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 3) {
              const free = parseInt(parts[0]) || 0;
              const size = parseInt(parts[1]) || 0;
              const caption = parts[2] || "?";
              disks.push({
                drive: caption,
                total: `${(size / 1024 / 1024 / 1024).toFixed(2)} GB`,
                free: `${(free / 1024 / 1024 / 1024).toFixed(2)} GB`,
                used: `${((size - free) / 1024 / 1024 / 1024).toFixed(2)} GB`,
                usagePercent: `${((size - free) / size * 100).toFixed(1)}%`,
              });
            }
          }
          resolve(JSON.stringify({ platform, disks }, null, 2));
        });
      });
    } else {
      // Unix: use df
      const { spawn } = await import("child_process");
      return new Promise((resolve) => {
        const child = spawn("df", ["-h", targetDir]);
        let output = "";
        child.stdout?.on("data", (data: Buffer) => {
          output += data.toString();
        });
        child.on("close", () => {
          const lines = output.split("\n").filter((l: string) => l.trim());
          const disks: any[] = [];
          for (const line of lines.slice(1)) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 6) {
              disks.push({
                filesystem: parts[0],
                total: parts[1],
                used: parts[2],
                available: parts[3],
                usagePercent: parts[4],
                mountPoint: parts[5],
              });
            }
          }
          resolve(JSON.stringify({ platform, disks }, null, 2));
        });
      });
    }
  } catch (err: any) {
    return `Error getting disk usage: ${err.message}`;
  }
}

export function getNetworkInfo(): string {
  const interfaces = os.networkInterfaces();
  const formatted: any[] = [];
  
  for (const [name, ifaces] of Object.entries(interfaces)) {
    if (ifaces) {
      for (const iface of ifaces) {
        formatted.push({
          interface: name,
          address: iface.address,
          netmask: iface.netmask,
          family: iface.family,
          mac: iface.mac,
          internal: iface.internal,
          cidr: iface.cidr,
        });
      }
    }
  }
  
  return JSON.stringify({
    interfaces: formatted,
    count: formatted.length,
  }, null, 2);
}

export function getEnvVarAnalysis(): string {
  const env = process.env;
  const analysis = {
    total: Object.keys(env).length,
    categories: {
      path: !!env.PATH,
      home: !!env.HOME || !!env.USERPROFILE,
      shell: !!env.SHELL || !!env.COMSPEC,
      language: !!env.LANG || !!env.LC_ALL,
      node: !!env.NODE_ENV,
      git: !!env.GIT_DIR || !!env.GIT_WORK_TREE,
      docker: !!env.DOCKER_HOST,
      aws: Object.keys(env).some(k => k.startsWith("AWS_")),
      azure: Object.keys(env).some(k => k.startsWith("AZURE_")),
      google: Object.keys(env).some(k => k.startsWith("GOOGLE_")),
    },
    sensitive: Object.keys(env).filter(k => 
      /key|secret|token|password|auth|private|credential/i.test(k)
    ),
  };
  
  return JSON.stringify(analysis, null, 2);
}
