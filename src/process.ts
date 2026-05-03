// BlackWhite — MCP DevKit
import { spawn } from "child_process";
import os from "os";

interface ProcessInfo {
  pid: string;
  name: string;
  cpu?: string;
  mem?: string;
}

function runCommand(cmd: string, args: string[], timeout = 10000): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { shell: true });
    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
    }, timeout);

    child.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString("utf-8");
    });

    child.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString("utf-8");
    });

    child.on("close", () => {
      clearTimeout(timer);
      resolve(stdout || stderr);
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve(`Error: ${err.message}`);
    });
  });
}

export async function listProcesses(): Promise<string> {
  const platform = os.platform();
  let output = "";

  if (platform === "win32") {
    output = await runCommand("tasklist", ["/fo", "csv", "/nh"]);
  } else {
    output = await runCommand("ps", ["-eo", "pid,comm,pcpu,pmem", "--no-headers"]);
  }

  const lines = output.split("\n").filter((l) => l.trim());
  const processes: ProcessInfo[] = [];

  if (platform === "win32") {
    for (const line of lines.slice(0, 100)) {
      const parts = line.split('","').map((p) => p.replace(/^"|"$/g, ""));
      if (parts.length >= 2) {
        processes.push({
          pid: parts[1]?.trim() || "?",
          name: parts[0]?.trim() || "?",
          mem: parts[4]?.trim() || undefined,
        });
      }
    }
  } else {
    for (const line of lines.slice(0, 100)) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 4) {
        processes.push({
          pid: parts[0],
          name: parts[1],
          cpu: parts[2],
          mem: parts[3],
        });
      }
    }
  }

  const result = {
    platform,
    count: processes.length,
    processes: processes.slice(0, 50),
  };

  return JSON.stringify(result, null, 2);
}

export async function killProcess(pid: string): Promise<string> {
  const platform = os.platform();
  try {
    if (platform === "win32") {
      await runCommand("taskkill", ["/pid", pid, "/f"]);
    } else {
      await runCommand("kill", [pid]);
    }
    return `Process ${pid} killed.`;
  } catch (err: any) {
    return `Error killing process ${pid}: ${err.message}`;
  }
}
