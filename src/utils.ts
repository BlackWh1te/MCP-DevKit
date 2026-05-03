// BlackWhite — MCP DevKit
import { randomUUID, createHash } from "crypto";

export function generateUUID(): string {
  return randomUUID();
}

export function hashText(text: string, algorithm: string = "sha256"): string {
  try {
    return createHash(algorithm).update(text, "utf-8").digest("hex");
  } catch {
    return `Unsupported algorithm: ${algorithm}. Use: md5, sha1, sha256, sha512`;
  }
}

export function base64Encode(text: string): string {
  return Buffer.from(text, "utf-8").toString("base64");
}

export function base64Decode(text: string): string {
  try {
    return Buffer.from(text, "base64").toString("utf-8");
  } catch {
    return "Error: Invalid base64 string";
  }
}

export function urlEncode(text: string): string {
  return encodeURIComponent(text);
}

export function urlDecode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return "Error: Invalid URL-encoded string";
  }
}

export function formatJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return "Error: Invalid JSON string";
  }
}

export function getCurrentTime(timezone?: string): string {
  const now = new Date();
  if (timezone) {
    try {
      return now.toLocaleString("en-US", { timeZone: timezone });
    } catch {
      return `Error: Invalid timezone '${timezone}'. Use IANA names like 'America/New_York', 'Europe/London'.`;
    }
  }
  return now.toISOString();
}

export function convertTime(time: string, sourceTimezone: string, targetTimezone: string): string {
  try {
    const [hours, minutes] = time.split(":").map(Number);
    const now = new Date();
    const date = new Date(
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes)
    );

    const sourceTime = new Date(date.toLocaleString("en-US", { timeZone: sourceTimezone }));
    const targetTime = new Date(date.toLocaleString("en-US", { timeZone: targetTimezone }));
    const diffMs = targetTime.getTime() - sourceTime.getTime();
    const result = new Date(date.getTime() + diffMs);

    return JSON.stringify(
      {
        source: time,
        sourceTimezone,
        targetTimezone,
        result: result.toLocaleString("en-US", { timeZone: targetTimezone }),
        result24h: `${String(result.getHours()).padStart(2, "0")}:${String(result.getMinutes()).padStart(2, "0")}`,
        timeDifferenceMinutes: Math.round(diffMs / 60000),
      },
      null,
      2
    );
  } catch {
    return "Error: Invalid time format. Use HH:MM with valid IANA timezone names.";
  }
}
