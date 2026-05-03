// BlackWhite — MCP DevKit
import { spawn, SpawnOptionsWithoutStdio } from "child_process";
import os from "os";

function detectDefaultShell(): string {
  const platform = os.platform();
  if (platform === "win32") {
    // Prefer PowerShell Core, then Windows PowerShell, then CMD
    return process.env.PSModulePath?.includes("PowerShell")
      ? "powershell"
      : "cmd";
  }
  return process.env.SHELL || "bash";
}

export async function runCommand(
  command: string,
  cwd?: string,
  shellOverride?: string,
  timeout = 30000
): Promise<string> {
  const shell = shellOverride || detectDefaultShell();
  const platform = os.platform();
  const isWin = platform === "win32";

  let args: string[];
  let cmdExe: string;

  if (shell === "cmd" || shell === "cmd.exe") {
    cmdExe = "cmd";
    args = ["/c", command];
  } else if (shell === "powershell" || shell === "powershell.exe" || shell === "pwsh") {
    cmdExe = "powershell";
    args = ["-Command", command];
  } else if (shell === "bash" || shell === "sh" || shell === "zsh") {
    cmdExe = shell;
    args = ["-c", command];
  } else {
    cmdExe = shell;
    args = ["-c", command];
  }

  const options: SpawnOptionsWithoutStdio = {
    cwd: cwd || process.cwd(),
    env: { ...process.env },
  };

  // On Windows, if using cmd/powershell, we can spawn directly
  // On Unix, spawn the shell with -c
  return new Promise((resolve) => {
    const child = spawn(cmdExe, args, options);
    let stdout = "";
    let stderr = "";
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!child.killed) child.kill("SIGKILL");
      }, 5000);
    }, timeout);

    child.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString("utf-8");
    });

    child.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString("utf-8");
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve(
        JSON.stringify(
          {
            stdout,
            stderr: stderr || err.message,
            exitCode: err.message.includes("ENOENT") ? 127 : 1,
            shell: cmdExe,
            platform,
            timeout: false,
          },
          null,
          2
        )
      );
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve(
        JSON.stringify(
          {
            stdout: stdout.slice(0, 50000),
            stderr: stderr.slice(0, 50000),
            exitCode: code ?? (killed ? -1 : 0),
            shell: cmdExe,
            platform,
            timeout: killed,
          },
          null,
          2
        )
      );
    });
  });
}
