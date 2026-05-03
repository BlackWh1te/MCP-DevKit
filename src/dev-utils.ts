// BlackWhite — MCP DevKit
import { randomBytes } from "crypto";

// ─── Text Diff ───────────────────────

interface DiffLine {
  type: "added" | "removed" | "context";
  line: string;
  oldNumber?: number;
  newNumber?: number;
}

export function diffText(oldText: string, newText: string, contextLines = 3): string {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");

  // Simple LCS-based diff
  const matrix: number[][] = Array(oldLines.length + 1)
    .fill(null)
    .map(() => Array(newLines.length + 1).fill(0));

  for (let i = 1; i <= oldLines.length; i++) {
    for (let j = 1; j <= newLines.length; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1] + 1;
      } else {
        matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
      }
    }
  }

  const result: DiffLine[] = [];
  let i = oldLines.length;
  let j = newLines.length;
  let oldNum = oldLines.length;
  let newNum = newLines.length;

  const temp: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      temp.unshift({ type: "context", line: oldLines[i - 1], oldNumber: oldNum, newNumber: newNum });
      i--; j--; oldNum--; newNum--;
    } else if (j > 0 && (i === 0 || matrix[i][j - 1] >= matrix[i - 1][j])) {
      temp.unshift({ type: "added", line: newLines[j - 1], newNumber: newNum });
      j--; newNum--;
    } else {
      temp.unshift({ type: "removed", line: oldLines[i - 1], oldNumber: oldNum });
      i--; oldNum--;
    }
  }

  // Group into hunks with context
  const hunks: DiffLine[][] = [];
  let currentHunk: DiffLine[] = [];
  let lastDiffIndex = -1;

  for (let idx = 0; idx < temp.length; idx++) {
    const line = temp[idx];
    if (line.type !== "context") {
      // Start new hunk if needed
      if (currentHunk.length === 0) {
        // Add preceding context
        for (let k = Math.max(0, idx - contextLines); k < idx; k++) {
          currentHunk.push(temp[k]);
        }
      }
      lastDiffIndex = idx;
    }
    if (lastDiffIndex >= 0 && idx <= lastDiffIndex + contextLines) {
      currentHunk.push(line);
    }
    if (idx === lastDiffIndex + contextLines && currentHunk.length > 0) {
      hunks.push(currentHunk);
      currentHunk = [];
      lastDiffIndex = -1;
    }
  }

  if (currentHunk.length > 0) {
    hunks.push(currentHunk);
  }

  if (hunks.length === 0) {
    return "No differences found.";
  }

  const lines: string[] = [`Diff (${oldLines.length} → ${newLines.length} lines, ${hunks.length} hunk${hunks.length > 1 ? "s" : ""}):`, ""];
  for (const hunk of hunks) {
    lines.push("@@ --- @@");
    for (const l of hunk) {
      const prefix = l.type === "added" ? "+" : l.type === "removed" ? "-" : " ";
      lines.push(`${prefix} ${l.line}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

// ─── Regex Test ──────────────────────

export function regexTest(pattern: string, text: string, flags = "g"): string {
  try {
    const regex = new RegExp(pattern, flags.includes("g") ? flags : flags + "g");
    const matches: Array<{ match: string; index: number; groups?: Record<string, string> }> = [];
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = regex.exec(text)) !== null && count < 100) {
      matches.push({
        match: m[0],
        index: m.index,
        groups: m.groups,
      });
      count++;
      if (m.index === regex.lastIndex) regex.lastIndex++;
    }
    return JSON.stringify(
      {
        pattern,
        flags,
        matchCount: matches.length,
        truncated: count >= 100,
        matches: matches.slice(0, 50),
      },
      null,
      2
    );
  } catch (err: any) {
    return `Invalid regex: ${err.message}`;
  }
}

// ─── Password Generator ──────────────

export function generatePassword(length = 16, options?: { uppercase?: boolean; lowercase?: boolean; numbers?: boolean; symbols?: boolean }): string {
  const opts = { uppercase: true, lowercase: true, numbers: true, symbols: true, ...options };
  const chars: string[] = [];
  if (opts.lowercase) chars.push("abcdefghijklmnopqrstuvwxyz");
  if (opts.uppercase) chars.push("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
  if (opts.numbers) chars.push("0123456789");
  if (opts.symbols) chars.push("!@#$%^&*()_+-=[]{}|;:,.<>?");

  if (chars.length === 0) return "Error: at least one character type must be enabled.";

  const allChars = chars.join("");
  let password = "";
  const bytes = randomBytes(length);
  for (let i = 0; i < length; i++) {
    password += allChars[bytes[i] % allChars.length];
  }

  return JSON.stringify({
    password,
    length,
    options: opts,
    entropy: Math.round(Math.log2(Math.pow(allChars.length, length))),
  }, null, 2);
}

// ─── JWT Decode ──────────────────────

export function jwtDecode(token: string): string {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return "Error: JWT must have 3 parts separated by dots.";

    const decodeBase64 = (str: string) => {
      const padding = "=".repeat((4 - (str.length % 4)) % 4);
      const base64 = str.replace(/-/g, "+").replace(/_/g, "/") + padding;
      return JSON.parse(Buffer.from(base64, "base64").toString("utf-8"));
    };

    const header = decodeBase64(parts[0]);
    const payload = decodeBase64(parts[1]);

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    const expired = payload.exp && payload.exp < now;
    const notBefore = payload.nbf && payload.nbf > now;

    return JSON.stringify(
      {
        header,
        payload,
        expired,
        notBefore,
        expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : null,
        issuedAt: payload.iat ? new Date(payload.iat * 1000).toISOString() : null,
        signaturePresent: parts[2].length > 0,
        note: "Signature NOT verified. This is for debugging only.",
      },
      null,
      2
    );
  } catch (err: any) {
    return `Error decoding JWT: ${err.message}`;
  }
}

// ─── Text Analysis ───────────────────

export function analyzeText(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines = text.split("\n");
  const chars = text.length;
  const charsNoSpaces = text.replace(/\s/g, "").length;
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);

  // Detect code
  const hasCode = /[{};<>/=]|function|class|const|let|var|import|def|fn/.test(text);

  return JSON.stringify(
    {
      words: words.length,
      lines: lines.length,
      characters: chars,
      charactersNoSpaces: charsNoSpaces,
      sentences: sentences.length,
      averageWordLength: words.length > 0 ? (charsNoSpaces / words.length).toFixed(1) : 0,
      longestLine: Math.max(...lines.map((l) => l.length)),
      appearsToBeCode: hasCode,
      languageHint: hasCode ? "possibly code" : "possibly prose",
    },
    null,
    2
    );
}

// ─── Color Convert ───────────────────

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export function convertColor(input: string): string {
  let result: Record<string, string> = {};

  // Hex input
  const hexMatch = /^#?([a-f\d]{6})$/i.exec(input.replace("#", ""));
  if (hexMatch) {
    const rgb = hexToRgb("#" + hexMatch[1]);
    if (rgb) {
      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
      result = {
        hex: "#" + hexMatch[1].toLowerCase(),
        rgb: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
        hsl: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`,
      };
    }
  }

  // RGB input
  const rgbMatch = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(input);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]), g = parseInt(rgbMatch[2]), b = parseInt(rgbMatch[3]);
    const hsl = rgbToHsl(r, g, b);
    result = {
      hex: rgbToHex(r, g, b),
      rgb: `rgb(${r}, ${g}, ${b})`,
      hsl: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`,
    };
  }

  // HSL input
  const hslMatch = /hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/.exec(input);
  if (hslMatch) {
    // Simplified HSL to RGB
    result = {
      input,
      note: "HSL to RGB conversion is approximate. Use hex or RGB for exact values.",
    };
  }

  if (Object.keys(result).length === 0) {
    return `Error: Could not parse color '${input}'. Supported formats: #RRGGBB, rgb(r, g, b)`;
  }

  return JSON.stringify(result, null, 2);
}

// ─── Math Evaluator ──────────────────

export function evaluateMath(expression: string): string {
  try {
    // Only allow safe math characters
    const sanitized = expression.replace(/[^0-9+\-*/().\s%^&|<>!=]/g, "");
    if (sanitized !== expression.trim()) {
      return "Error: Expression contains invalid characters. Only numbers, operators, and parentheses are allowed.";
    }

    // Use Function instead of eval for slightly better isolation
    const result = new Function(`return (${sanitized})`)();
    return JSON.stringify({ expression: sanitized, result, type: typeof result }, null, 2);
  } catch (err: any) {
    return `Error evaluating expression: ${err.message}`;
  }
}
