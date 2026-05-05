// BlackWhite — MCP DevKit

interface HttpRequestInput {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
  cache?: boolean;
  cacheTTL?: number;
  expectJson?: boolean;
  validateStatus?: number;
}

interface CacheEntry {
  response: string;
  timestamp: number;
}

interface RequestMetric {
  url: string;
  method: string;
  status: number | null;
  latencyMs: number;
  timestamp: number;
  success: boolean;
  responseSize: number;
  error?: string;
}

interface DomainStats {
  domain: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  lastFailure: string | null;
  circuitOpen: boolean;
  circuitOpenUntil: number;
  consecutiveFailures: number;
}

const responseCache = new Map<string, CacheEntry>();
const requestMetrics: RequestMetric[] = [];
const domainStats = new Map<string, DomainStats>();

const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_COOLDOWN_MS = 30000;
const MAX_METRICS = 500;
const MAX_CACHE_ENTRIES = 100;
const MAX_DOMAIN_STATS = 100;

function getCacheKey(url: string, method: string, body?: string): string {
  return `${method}:${url}:${body || ""}`;
}

function getCachedResponse(key: string, ttl: number): string | null {
  const entry = responseCache.get(key);
  if (!entry) return null;

  const age = Date.now() - entry.timestamp;
  if (age > ttl) {
    responseCache.delete(key);
    return null;
  }

  // LRU: move to end (most recently used)
  responseCache.delete(key);
  responseCache.set(key, entry);
  return entry.response;
}

function setCachedResponse(key: string, response: string): void {
  responseCache.set(key, {
    response,
    timestamp: Date.now(),
  });

  // LRU eviction: delete oldest (first) entry when over limit
  while (responseCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = Array.from(responseCache.keys())[0];
    responseCache.delete(oldestKey);
  }
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

function getOrCreateDomainStats(domain: string): DomainStats {
  if (!domainStats.has(domain)) {
    // Evict oldest domain if at limit
    if (domainStats.size >= MAX_DOMAIN_STATS) {
      const oldestKey = Array.from(domainStats.keys())[0];
      domainStats.delete(oldestKey);
    }
    domainStats.set(domain, {
      domain,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      avgLatencyMs: 0,
      p95LatencyMs: 0,
      lastFailure: null,
      circuitOpen: false,
      circuitOpenUntil: 0,
      consecutiveFailures: 0,
    });
  }
  return domainStats.get(domain)!;
}

function recordMetric(metric: RequestMetric) {
  requestMetrics.push(metric);
  if (requestMetrics.length > MAX_METRICS) {
    requestMetrics.shift();
  }

  const domain = getDomain(metric.url);
  const stats = getOrCreateDomainStats(domain);

  stats.totalRequests++;
  if (metric.success) {
    stats.successfulRequests++;
    stats.consecutiveFailures = 0;
    stats.circuitOpen = false;
  } else {
    stats.failedRequests++;
    stats.consecutiveFailures++;
    stats.lastFailure = new Date(metric.timestamp).toISOString();

    if (stats.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
      stats.circuitOpen = true;
      stats.circuitOpenUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
    }
  }

  // Recalculate latencies for this domain
  const domainMetrics = requestMetrics.filter((m) => getDomain(m.url) === domain && m.success);
  if (domainMetrics.length > 0) {
    const latencies = domainMetrics.map((m) => m.latencyMs).sort((a, b) => a - b);
    stats.avgLatencyMs = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
    const p95Index = Math.floor(latencies.length * 0.95);
    stats.p95LatencyMs = latencies[Math.min(p95Index, latencies.length - 1)];
  }
}

function isCircuitOpen(domain: string): boolean {
  const stats = domainStats.get(domain);
  if (!stats) return false;
  if (!stats.circuitOpen) return false;
  if (Date.now() > stats.circuitOpenUntil) {
    stats.circuitOpen = false;
    stats.consecutiveFailures = 0;
    return false;
  }
  return true;
}

function validateResponse(
  status: number,
  contentType: string,
  body: string,
  expectJson?: boolean,
  validateStatus?: number,
): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (validateStatus && status !== validateStatus) {
    warnings.push(`Expected status ${validateStatus}, got ${status}`);
  }

  if (expectJson && !contentType.includes("application/json")) {
    warnings.push(`Expected JSON but content-type is ${contentType || "missing"}`);
  }

  if (!body || body.trim().length === 0) {
    warnings.push("Response body is empty");
  }

  if (expectJson && body) {
    try {
      JSON.parse(body);
    } catch {
      warnings.push("Response body is not valid JSON");
    }
  }

  return { valid: warnings.length === 0, warnings };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function httpRequest(input: HttpRequestInput): Promise<string> {
  const {
    url,
    method = "GET",
    headers = {},
    body,
    timeout = 30000,
    retryCount = 3,
    retryDelay = 1000,
    cache = false,
    cacheTTL = 60000,
    expectJson = false,
    validateStatus,
  } = input;

  const domain = getDomain(url);

  // Circuit breaker check
  if (isCircuitOpen(domain)) {
    const stats = domainStats.get(domain)!;
    const secondsRemaining = Math.ceil((stats.circuitOpenUntil - Date.now()) / 1000);
    return JSON.stringify(
      {
        error: `Circuit breaker OPEN for ${domain}. Try again in ${secondsRemaining}s.`,
        circuitBreaker: true,
        domain,
      },
      null,
      2,
    );
  }

  const cacheKey = getCacheKey(url, method.toUpperCase(), body);

  // Check cache for GET requests
  if (cache && method.toUpperCase() === "GET") {
    const cached = getCachedResponse(cacheKey, cacheTTL);
    if (cached) {
      return cached;
    }
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retryCount; attempt++) {
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      const fetchOptions: RequestInit = {
        method: method.toUpperCase(),
        headers,
        signal: controller.signal,
      };

      if (body && ["POST", "PUT", "PATCH"].includes(method.toUpperCase())) {
        fetchOptions.body = body;
        if (!headers["Content-Type"] && !headers["content-type"]) {
          (fetchOptions.headers as Record<string, string>)["Content-Type"] = "application/json";
        }
      }

      const response = await fetch(url, fetchOptions);
      clearTimeout(timer);

      const latencyMs = Date.now() - startTime;
      const contentType = response.headers.get("content-type") || "";
      let responseBody: string;

      if (contentType.includes("application/json")) {
        const json = await response.json();
        responseBody = JSON.stringify(json, null, 2);
      } else {
        responseBody = await response.text();
      }

      const truncated = responseBody.length > 50000;
      const trimmedBody = responseBody.slice(0, 50000);

      // Validation
      const validation = validateResponse(response.status, contentType, trimmedBody, expectJson, validateStatus);

      const result = {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: trimmedBody,
        truncated,
        attempt: attempt + 1,
        cached: false,
        latencyMs,
        domain,
        validation: validation.valid ? "passed" : "warnings",
        validationWarnings: validation.warnings,
      };

      const success = response.ok && validation.valid;
      recordMetric({
        url,
        method: method.toUpperCase(),
        status: response.status,
        latencyMs,
        timestamp: Date.now(),
        success,
        responseSize: responseBody.length,
      });

      const resultString = JSON.stringify(result, null, 2);

      // Cache successful GET requests
      if (cache && method.toUpperCase() === "GET" && response.ok) {
        setCachedResponse(cacheKey, resultString);
      }

      return resultString;
    } catch (err: any) {
      lastError = err;
      const latencyMs = Date.now() - startTime;

      // Don't retry on abort errors (timeout)
      if (err.name === "AbortError") {
        recordMetric({
          url,
          method: method.toUpperCase(),
          status: null,
          latencyMs,
          timestamp: Date.now(),
          success: false,
          responseSize: 0,
          error: "Request timed out",
        });
        return JSON.stringify({ error: "Request timed out", latencyMs, domain }, null, 2);
      }

      recordMetric({
        url,
        method: method.toUpperCase(),
        status: null,
        latencyMs,
        timestamp: Date.now(),
        success: false,
        responseSize: 0,
        error: err.message,
      });

      // Don't retry on last attempt
      if (attempt === retryCount) {
        break;
      }

      // Exponential backoff
      const delay = retryDelay * Math.pow(2, attempt);
      await sleep(delay);
    }
  }

  return JSON.stringify({ error: lastError?.message || "Request failed", domain }, null, 2);
}

export function clearHttpCache(): string {
  responseCache.clear();
  return "HTTP cache cleared.";
}

export function getHttpCacheStats(): string {
  const stats = {
    size: responseCache.size,
    entries: Array.from(responseCache.keys()),
  };
  return JSON.stringify(stats, null, 2);
}

export function getHttpPerformance(): string {
  if (requestMetrics.length === 0) {
    return "No HTTP request metrics recorded yet.";
  }

  const total = requestMetrics.length;
  const successful = requestMetrics.filter((m) => m.success).length;
  const failed = total - successful;
  const avgLatency = Math.round(requestMetrics.reduce((a, m) => a + m.latencyMs, 0) / total);
  const latencies = requestMetrics.map((m) => m.latencyMs).sort((a, b) => a - b);
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];

  const domainReport: DomainStats[] = [];
  for (const stats of domainStats.values()) {
    domainReport.push({ ...stats });
  }
  domainReport.sort((a, b) => b.totalRequests - a.totalRequests);

  const report = {
    totalRequests: total,
    successRate: `${((successful / total) * 100).toFixed(1)}%`,
    failedRequests: failed,
    avgLatencyMs: avgLatency,
    p95LatencyMs: p95,
    p99LatencyMs: p99,
    topDomains: domainReport.slice(0, 10),
  };

  return JSON.stringify(report, null, 2);
}

export function resetCircuitBreaker(domain?: string): string {
  if (domain) {
    const stats = domainStats.get(domain);
    if (stats) {
      stats.circuitOpen = false;
      stats.consecutiveFailures = 0;
      stats.circuitOpenUntil = 0;
      return `Circuit breaker reset for ${domain}.`;
    }
    return `No circuit breaker found for ${domain}.`;
  }

  for (const stats of domainStats.values()) {
    stats.circuitOpen = false;
    stats.consecutiveFailures = 0;
    stats.circuitOpenUntil = 0;
  }
  return `Circuit breakers reset for all ${domainStats.size} tracked domains.`;
}

export function clearHttpMetrics(): string {
  requestMetrics.length = 0;
  domainStats.clear();
  return "HTTP metrics and circuit breakers cleared.";
}
