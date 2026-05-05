// BlackWhite — MCP DevKit
import { describe, it, expect, vi } from "vitest";
import {
  httpRequest, clearHttpCache, getHttpCacheStats,
  getHttpPerformance, resetCircuitBreaker, clearHttpMetrics,
} from "../src/http.js";

describe("http", () => {
  it("clears cache and reports empty stats", () => {
    clearHttpCache();
    const stats = JSON.parse(getHttpCacheStats());
    expect(stats.size).toBe(0);
    expect(stats.entries).toEqual([]);
  });

  it("reports no metrics initially", () => {
    clearHttpMetrics();
    expect(getHttpPerformance()).toContain("No HTTP request metrics");
  });

  it("resets circuit breaker with no domains", () => {
    clearHttpMetrics();
    const result = resetCircuitBreaker();
    expect(result).toContain("0 tracked domains");
  });

  it("makes a request and records metrics", async () => {
    clearHttpMetrics();
    clearHttpCache();

    const mockFetch = vi.fn();
    globalThis.fetch = mockFetch;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Map([["content-type", "application/json"]]),
      json: async () => ({ success: true }),
    } as any);

    const result = await httpRequest({
      url: "https://example.com/test",
      method: "GET",
      cache: true,
    });

    const parsed = JSON.parse(result);
    expect(parsed.status).toBe(200);
    expect(parsed.cached).toBe(false);

    // Second call should hit cache (returns same result string)
    const cachedResult = await httpRequest({
      url: "https://example.com/test",
      method: "GET",
      cache: true,
    });
    expect(cachedResult).toBe(result);

    // Metrics should be recorded
    const perf = JSON.parse(getHttpPerformance());
    expect(perf.totalRequests).toBeGreaterThanOrEqual(1);

    clearHttpCache();
    clearHttpMetrics();
  });

  it("handles request errors", async () => {
    clearHttpMetrics();

    const mockFetch = vi.fn();
    globalThis.fetch = mockFetch;
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await httpRequest({
      url: "https://example.com/fail",
      method: "GET",
      retryCount: 0,
    });

    const parsed = JSON.parse(result);
    expect(parsed.error).toContain("Network error");

    clearHttpMetrics();
  });

  it("respects timeout with AbortError", async () => {
    clearHttpMetrics();

    const mockFetch = vi.fn();
    globalThis.fetch = mockFetch;
    mockFetch.mockImplementationOnce(
      () => new Promise((_, reject) => {
        setTimeout(() => {
          const err = new Error("AbortError");
          (err as any).name = "AbortError";
          reject(err);
        }, 10);
      })
    );

    const result = await httpRequest({
      url: "https://example.com/timeout",
      method: "GET",
      timeout: 5,
      retryCount: 0,
    });

    const parsed = JSON.parse(result);
    expect(parsed.error).toContain("timed out");

    clearHttpMetrics();
  });
});
