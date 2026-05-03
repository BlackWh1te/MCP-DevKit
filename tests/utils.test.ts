// BlackWhite — MCP DevKit
import { describe, it, expect } from "vitest";
import {
  generateUUID, hashText, base64Encode, base64Decode,
  urlEncode, urlDecode, formatJson, getCurrentTime,
} from "../src/utils.js";

describe("utils", () => {
  it("generates a valid UUID", () => {
    const uuid = generateUUID();
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("hashes text with sha256", () => {
    const hash = hashText("hello", "sha256");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hashes text with md5", () => {
    const hash = hashText("hello", "md5");
    expect(hash).toHaveLength(32);
  });

  it("base64 encodes and decodes", () => {
    const encoded = base64Encode("hello world");
    expect(encoded).toBe("aGVsbG8gd29ybGQ=");
    expect(base64Decode(encoded)).toBe("hello world");
  });

  it("URL encodes and decodes", () => {
    const encoded = urlEncode("hello world!");
    expect(encoded).toBe("hello%20world!");
    expect(urlDecode(encoded)).toBe("hello world!");
  });

  it("formats JSON", () => {
    const formatted = formatJson('{"a":1,"b":2}');
    expect(formatted).toContain("\"a\": 1");
    expect(formatted).toContain("\"b\": 2");
  });

  it("returns current time", () => {
    const time = getCurrentTime();
    expect(new Date(time).getTime()).not.toBeNaN();
  });
});
