// BlackWhite — MCP DevKit
import { describe, it, expect } from "vitest";
import {
  diffText,
  regexTest,
  generatePassword,
  jwtDecode,
  analyzeText,
  convertColor,
  evaluateMath,
} from "../src/dev-utils.js";

describe("Dev Utils", () => {
  describe("diffText", () => {
    it("should diff two text strings", () => {
      const result = diffText("hello world", "hello there");
      expect(result).toContain("hello");
      expect(typeof result).toBe("string");
    });
  });

  describe("regexTest", () => {
    it("should test regex pattern", () => {
      const result = regexTest("\\d+", "test 123 test");
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty("matches");
      expect(parsed.matches[0]?.match).toBe("123");
    });

    it("should handle flags", () => {
      const result = regexTest("test", "Test TEST test", "gi");
      const parsed = JSON.parse(result);
      expect(parsed.matches.length).toBe(3);
    });
  });

  describe("generatePassword", () => {
    it("should generate password with default settings", () => {
      const password = generatePassword();
      expect(password).toBeDefined();
    });

    it("should generate password with custom length", () => {
      const password = generatePassword(32, { uppercase: true, lowercase: true, numbers: true, symbols: true });
      expect(password).toBeDefined();
    });

    it("should generate password without symbols", () => {
      const password = generatePassword(16, { uppercase: true, lowercase: true, numbers: true, symbols: false });
      expect(password).toBeDefined();
    });
  });

  describe("jwtDecode", () => {
    it("should decode JWT token", () => {
      const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
      const result = jwtDecode(token);
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty("header");
      expect(parsed).toHaveProperty("payload");
      expect(parsed.payload).toHaveProperty("sub", "1234567890");
    });

    it("should handle invalid token", () => {
      const result = jwtDecode("invalid.token");
      expect(result).toContain("Error");
    });
  });

  describe("analyzeText", () => {
    it("should analyze text statistics", () => {
      const text = "Hello world! This is a test.";
      const result = analyzeText(text);
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty("words");
      expect(parsed).toHaveProperty("characters");
      expect(parsed).toHaveProperty("sentences");
      expect(parsed.words).toBeGreaterThan(0);
    });
  });

  describe("convertColor", () => {
    it("should convert hex to all formats", () => {
      const result = convertColor("#ff0000");
      expect(result).toContain("hex");
      expect(result).toContain("rgb");
      expect(result).toContain("hsl");
    });

    it("should convert rgb to all formats", () => {
      const result = convertColor("rgb(255, 0, 0)");
      expect(result).toContain("hex");
      expect(result).toContain("rgb");
      expect(result).toContain("hsl");
    });

    it("should handle invalid color", () => {
      const result = convertColor("invalid");
      expect(result).toContain("Error");
    });
  });

  describe("evaluateMath", () => {
    it("should evaluate simple expression", () => {
      const result = evaluateMath("2 + 2");
      const parsed = JSON.parse(result);
      expect(parsed.result).toBe(4);
    });

    it("should evaluate complex expression", () => {
      const result = evaluateMath("(10 + 5) * 2");
      const parsed = JSON.parse(result);
      expect(parsed.result).toBe(30);
    });

    it("should handle invalid expression", () => {
      const result = evaluateMath("invalid");
      expect(result).toContain("Error");
    });
  });
});
