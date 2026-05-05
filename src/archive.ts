// BlackWhite — MCP DevKit
import { promises as fs, createReadStream, createWriteStream } from "fs";
import path from "path";
import { createGzip, createGunzip } from "zlib";
import { pipeline } from "stream/promises";
import { execSync } from "child_process";

interface ArchiveEntry {
  name: string;
  size: number;
  isDirectory: boolean;
  modified: string;
}

interface _ArchiveInfo {
  path: string;
  type: "zip" | "tar" | "tar.gz" | "gz" | "unknown";
  entries: ArchiveEntry[];
  totalSize: number;
  entryCount: number;
}

function detectArchiveType(filePath: string): "zip" | "tar" | "tar.gz" | "gz" | "unknown" {
  const ext = path.extname(filePath).toLowerCase();
  const base = path.basename(filePath).toLowerCase();
  if (ext === ".zip") return "zip";
  if (ext === ".gz" || ext === ".gzip") return base.endsWith(".tar.gz") ? "tar.gz" : "gz";
  if (ext === ".tgz") return "tar.gz";
  if (ext === ".tar") return "tar";
  return "unknown";
}

async function listZipEntries(zipPath: string): Promise<ArchiveEntry[]> {
  const entries: ArchiveEntry[] = [];
  try {
    // Use PowerShell on Windows, unzip on Unix
    if (process.platform === "win32") {
      const output = execSync(
        `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath (Join-Path $env:TEMP 'zipcheck') -PassThru | Select-Object FullName, Length, LastWriteTime, PSIsContainer | ConvertTo-Json -AsArray"`,
        {
          encoding: "utf-8",
          timeout: 30000,
        },
      );
      const items = JSON.parse(output) as Array<{
        FullName: string;
        Length: number;
        LastWriteTime: string;
        PSIsContainer: boolean;
      }>;
      for (const item of Array.isArray(items) ? items : [items]) {
        if (item) {
          entries.push({
            name: item.FullName,
            size: item.Length || 0,
            isDirectory: !!item.PSIsContainer,
            modified: item.LastWriteTime,
          });
        }
      }
    } else {
      const output = execSync(`unzip -l "${zipPath}"`, { encoding: "utf-8", timeout: 30000 });
      const lines = output.split("\n");
      for (const line of lines) {
        const match = line.match(/^\s*(\d+)\s+(\d{2}-\d{2}-\d{4})\s+(\d{2}:\d{2})\s+(.+)$/);
        if (match) {
          entries.push({
            name: match[4].trim(),
            size: parseInt(match[1], 10),
            isDirectory: match[4].trim().endsWith("/"),
            modified: match[2],
          });
        }
      }
    }
  } catch {
    // Fallback: try to extract to temp and list
  }
  return entries;
}

async function listTarEntries(tarPath: string): Promise<ArchiveEntry[]> {
  const entries: ArchiveEntry[] = [];
  try {
    const output = execSync(`tar -tf "${tarPath}"`, { encoding: "utf-8", timeout: 30000 });
    const names = output.split("\n").filter(Boolean);
    for (const name of names) {
      entries.push({
        name,
        size: 0, // tar -t doesn't show sizes easily
        isDirectory: name.endsWith("/"),
        modified: "",
      });
    }
  } catch {
    // Fallback
  }
  return entries;
}

export async function createArchive(
  sourcePaths: string[],
  outputPath: string,
  format?: "zip" | "tar" | "tar.gz",
): Promise<string> {
  const resolvedOutput = path.resolve(outputPath);
  const resolvedSources = sourcePaths.map((p) => path.resolve(p));

  // Auto-detect format from extension if not specified
  let archiveFormat: "zip" | "tar" | "tar.gz" = format ?? "zip";
  if (!format) {
    const detected = detectArchiveType(resolvedOutput);
    if (detected === "zip" || detected === "tar" || detected === "tar.gz") {
      archiveFormat = detected;
    }
  }

  try {
    await fs.mkdir(path.dirname(resolvedOutput), { recursive: true });

    const cwd = process.cwd();

    if (archiveFormat === "zip") {
      if (process.platform === "win32") {
        // PowerShell Compress-Archive
        const sourcesArg = resolvedSources.join("', '");
        execSync(
          `powershell -Command "Compress-Archive -Path '${sourcesArg}' -DestinationPath '${resolvedOutput}' -Force"`,
          { timeout: 60000, cwd },
        );
      } else {
        const sourcesArg = resolvedSources.map((s) => `"${s}"`).join(" ");
        execSync(`zip -r "${resolvedOutput}" ${sourcesArg}`, { timeout: 60000, cwd });
      }
    } else if (archiveFormat === "tar") {
      const sourcesArg = resolvedSources.map((s) => `"${s}"`).join(" ");
      execSync(`tar -cf "${resolvedOutput}" ${sourcesArg}`, { timeout: 60000, cwd });
    } else if (archiveFormat === "tar.gz") {
      const sourcesArg = resolvedSources.map((s) => `"${s}"`).join(" ");
      execSync(`tar -czf "${resolvedOutput}" ${sourcesArg}`, { timeout: 60000, cwd });
    }

    const stat = await fs.stat(resolvedOutput);
    return `Created ${archiveFormat} archive: ${resolvedOutput} (${stat.size} bytes) from ${resolvedSources.length} source(s).`;
  } catch (err) {
    return `Archive creation failed: ${err instanceof Error ? err.message : String(err)}`;
  }
}

export async function extractArchive(archivePath: string, outputDir?: string): Promise<string> {
  const resolvedArchive = path.resolve(archivePath);
  const resolvedOutput = outputDir
    ? path.resolve(outputDir)
    : path.join(path.dirname(resolvedArchive), path.basename(resolvedArchive, path.extname(resolvedArchive)));

  const format = detectArchiveType(resolvedArchive);

  try {
    await fs.mkdir(resolvedOutput, { recursive: true });

    if (format === "zip") {
      if (process.platform === "win32") {
        execSync(
          `powershell -Command "Expand-Archive -Path '${resolvedArchive}' -DestinationPath '${resolvedOutput}' -Force"`,
          { timeout: 60000 },
        );
      } else {
        execSync(`unzip -o "${resolvedArchive}" -d "${resolvedOutput}"`, { timeout: 60000 });
      }
    } else if (format === "tar") {
      execSync(`tar -xf "${resolvedArchive}" -C "${resolvedOutput}"`, { timeout: 60000 });
    } else if (format === "tar.gz") {
      execSync(`tar -xzf "${resolvedArchive}" -C "${resolvedOutput}"`, { timeout: 60000 });
    } else if (format === "gz") {
      // Single file gzip
      const outputFile = path.join(resolvedOutput, path.basename(resolvedArchive, ".gz"));
      await pipeline(createReadStream(resolvedArchive), createGunzip(), createWriteStream(outputFile));
    } else {
      return `Unknown archive format for ${resolvedArchive}. Supported: .zip, .tar, .tar.gz, .tgz, .gz`;
    }

    return `Extracted ${format} archive to ${resolvedOutput}.`;
  } catch (err) {
    return `Extraction failed: ${err instanceof Error ? err.message : String(err)}`;
  }
}

export async function getArchiveInfo(archivePath: string): Promise<string> {
  const resolvedArchive = path.resolve(archivePath);

  try {
    const stat = await fs.stat(resolvedArchive);
    const format = detectArchiveType(resolvedArchive);

    let entries: ArchiveEntry[] = [];
    if (format === "zip") {
      entries = await listZipEntries(resolvedArchive);
    } else if (format === "tar" || format === "tar.gz") {
      entries = await listTarEntries(resolvedArchive);
    }

    const totalSize = entries.reduce((sum, e) => sum + e.size, 0);
    const dirCount = entries.filter((e) => e.isDirectory).length;
    const fileCount = entries.length - dirCount;

    const lines: string[] = [
      `# Archive: ${resolvedArchive}`,
      `Format: ${format}`,
      `Size: ${stat.size} bytes`,
      `Modified: ${stat.mtime.toISOString()}`,
      ``,
      `## Contents (${fileCount} files, ${dirCount} directories, ${entries.length} total entries)`,
      `Total uncompressed size: ${totalSize} bytes`,
      "",
    ];

    for (const e of entries.slice(0, 50)) {
      const type = e.isDirectory ? "[DIR]" : "[FILE]";
      const size = e.isDirectory ? "" : ` (${e.size} bytes)`;
      lines.push(`${type} ${e.name}${size}`);
    }

    if (entries.length > 50) {
      lines.push("");
      lines.push(`... and ${entries.length - 50} more entries`);
    }

    return lines.join("\n");
  } catch (err) {
    return `Failed to read archive info: ${err instanceof Error ? err.message : String(err)}`;
  }
}

export async function gzipFile(filePath: string, outputPath?: string): Promise<string> {
  const resolvedInput = path.resolve(filePath);
  const resolvedOutput = outputPath ? path.resolve(outputPath) : `${resolvedInput}.gz`;

  try {
    await pipeline(createReadStream(resolvedInput), createGzip(), createWriteStream(resolvedOutput));

    const inStat = await fs.stat(resolvedInput);
    const outStat = await fs.stat(resolvedOutput);
    const ratio = ((1 - outStat.size / inStat.size) * 100).toFixed(1);

    return `Compressed ${resolvedInput} → ${resolvedOutput} (${inStat.size} → ${outStat.size} bytes, ${ratio}% reduction).`;
  } catch (err) {
    return `Compression failed: ${err instanceof Error ? err.message : String(err)}`;
  }
}

export async function gunzipFile(filePath: string, outputPath?: string): Promise<string> {
  const resolvedInput = path.resolve(filePath);
  const resolvedOutput = outputPath ? path.resolve(outputPath) : resolvedInput.replace(/\.gz$/, "");

  try {
    await pipeline(createReadStream(resolvedInput), createGunzip(), createWriteStream(resolvedOutput));

    const outStat = await fs.stat(resolvedOutput);
    return `Decompressed ${resolvedInput} → ${resolvedOutput} (${outStat.size} bytes).`;
  } catch (err) {
    return `Decompression failed: ${err instanceof Error ? err.message : String(err)}`;
  }
}
