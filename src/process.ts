// BlackWhite — MCP DevKit
import { spawn } from "child_process";
import os from "os";

interface ProcessInfo {
  pid: string;
  name: string;
  cpu?: string;
  mem?: string;
  user?: string;
  command?: string;
  startTime?: string;
}

interface ProcessTree {
  pid: string;
  name: string;
  children: ProcessTree[];
}

interface ProcessMonitoring {
  pid: string;
  history: {
    timestamp: number;
    cpu: number;
    memory: number;
  }[];
}

const processHistory = new Map<string, ProcessMonitoring>();

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
    output = await runCommand("tasklist", ["/fo", "csv", "/nh", "/v"]);
  } else {
    output = await runCommand("ps", ["-eo", "pid,user,comm,pcpu,pmem,lstart", "--no-headers"]);
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
      if (parts.length >= 6) {
        processes.push({
          pid: parts[0],
          user: parts[1],
          name: parts[2],
          cpu: parts[3],
          mem: parts[4],
          startTime: parts.slice(5).join(" "),
        });
      }
    }
  }

  // Update process history for monitoring
  for (const proc of processes) {
    const history = processHistory.get(proc.pid) || { pid: proc.pid, history: [] };
    const cpu = parseFloat(proc.cpu || "0");
    const mem = parseFloat(proc.mem || "0");
    
    history.history.push({
      timestamp: Date.now(),
      cpu,
      memory: mem,
    });
    
    // Keep only last 100 data points
    if (history.history.length > 100) {
      history.history.shift();
    }
    
    processHistory.set(proc.pid, history);
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
    
    // Remove from history
    processHistory.delete(pid);
    
    return `Process ${pid} killed.`;
  } catch (err: any) {
    return `Error killing process ${pid}: ${err.message}`;
  }
}

export async function getProcessTree(pid?: string): Promise<string> {
  const platform = os.platform();
  let output = "";

  if (platform === "win32") {
    // Windows doesn't have a built-in pstree, use tasklist with parent info
    output = await runCommand("wmic", ["process", "get", "ParentProcessId,ProcessId,Name", "/format:csv"]);
  } else {
    output = await runCommand("pstree", pid ? ["-p", pid] : ["-p"]);
  }

  if (platform === "win32") {
    // Parse Windows output and build tree
    const lines = output.split("\n").filter((l) => l.trim());
    const processMap = new Map<string, { pid: string; name: string; parent: string; children: string[] }>();
    
    for (const line of lines.slice(1)) {
      const parts = line.split(",").map((p) => p.replace(/^"|"$/g, ""));
      if (parts.length >= 3) {
        const parent = parts[0]?.trim();
        const pid = parts[1]?.trim();
        const name = parts[2]?.trim();
        
        if (pid && name) {
          processMap.set(pid, { pid, name, parent: parent || "0", children: [] });
        }
      }
    }
    
    // Build tree structure
    const roots: ProcessTree[] = [];
    const visited = new Set<string>();
    
    for (const [pid, proc] of processMap) {
      if (proc.parent === "0" || !processMap.has(proc.parent)) {
        roots.push(buildProcessTree(proc, processMap, visited));
      }
    }
    
    return JSON.stringify({ platform, tree: roots }, null, 2);
  } else {
    // Unix pstree output is already a tree
    return JSON.stringify({ platform, tree: output }, null, 2);
  }
}

function buildProcessTree(proc: { pid: string; name: string; parent: string; children: string[] }, 
                          processMap: Map<string, { pid: string; name: string; parent: string; children: string[] }>,
                          visited: Set<string>): ProcessTree {
  if (visited.has(proc.pid)) {
    return { pid: proc.pid, name: proc.name + " (cycle)", children: [] };
  }
  
  visited.add(proc.pid);
  
  const children: ProcessTree[] = [];
  for (const [childPid, childProc] of processMap) {
    if (childProc.parent === proc.pid) {
      children.push(buildProcessTree(childProc, processMap, visited));
    }
  }
  
  return { pid: proc.pid, name: proc.name, children };
}

export async function monitorProcess(pid: string, duration = 60000): Promise<string> {
  const startTime = Date.now();
  const samples: { timestamp: number; cpu: number; memory: number }[] = [];
  
  while (Date.now() - startTime < duration) {
    const platform = os.platform();
    let output = "";
    
    if (platform === "win32") {
      output = await runCommand("tasklist", ["/fi", `PID eq ${pid}`, "/fo", "csv", "/nh"]);
    } else {
      output = await runCommand("ps", ["-p", pid, "-o", "pcpu,pmem", "--no-headers"]);
    }
    
    const cpu = parseFloat(output.match(/[\d.]+/g)?.[0] || "0");
    const mem = parseFloat(output.match(/[\d.]+/g)?.[1] || "0");
    
    samples.push({
      timestamp: Date.now(),
      cpu,
      memory: mem,
    });
    
    // Sample every second
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  const avgCpu = samples.reduce((sum, s) => sum + s.cpu, 0) / samples.length;
  const avgMem = samples.reduce((sum, s) => sum + s.memory, 0) / samples.length;
  const maxCpu = Math.max(...samples.map(s => s.cpu));
  const maxMem = Math.max(...samples.map(s => s.memory));
  
  return JSON.stringify({
    pid,
    duration,
    samples,
    statistics: {
      averageCpu: avgCpu.toFixed(2),
      averageMemory: avgMem.toFixed(2),
      maxCpu: maxCpu.toFixed(2),
      maxMemory: maxMem.toFixed(2),
    },
  }, null, 2);
}

export async function filterProcesses(filter: { name?: string; user?: string; minCpu?: number; minMem?: number }): Promise<string> {
  const allProcesses = JSON.parse(await listProcesses());
  const filtered = allProcesses.processes.filter((p: ProcessInfo) => {
    if (filter.name && !p.name.toLowerCase().includes(filter.name.toLowerCase())) return false;
    if (filter.user && !p.user?.toLowerCase().includes(filter.user.toLowerCase())) return false;
    if (filter.minCpu && parseFloat(p.cpu || "0") < filter.minCpu) return false;
    if (filter.minMem && parseFloat(p.mem || "0") < filter.minMem) return false;
    return true;
  });
  
  return JSON.stringify({
    filter,
    count: filtered.length,
    processes: filtered,
  }, null, 2);
}

export function clearProcessHistory(): string {
  processHistory.clear();
  return "Process monitoring history cleared.";
}

export function getProcessHistory(pid?: string): string {
  if (pid) {
    const history = processHistory.get(pid);
    return history ? JSON.stringify(history, null, 2) : JSON.stringify({ error: "No history found for PID" }, null, 2);
  }
  
  const allHistory = Array.from(processHistory.values());
  return JSON.stringify({
    totalProcesses: allHistory.length,
    history: allHistory,
  }, null, 2);
}
