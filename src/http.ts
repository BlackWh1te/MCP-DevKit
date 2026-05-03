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
}

interface CacheEntry {
  response: string;
  timestamp: number;
}

const responseCache = new Map<string, CacheEntry>();

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
  
  return entry.response;
}

function setCachedResponse(key: string, response: string): void {
  responseCache.set(key, {
    response,
    timestamp: Date.now(),
  });
  
  // Limit cache size
  if (responseCache.size > 100) {
    const oldestKey = Array.from(responseCache.keys())[0];
    responseCache.delete(oldestKey);
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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
  } = input;

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

      const contentType = response.headers.get("content-type") || "";
      let responseBody: string;

      if (contentType.includes("application/json")) {
        const json = await response.json();
        responseBody = JSON.stringify(json, null, 2);
      } else {
        responseBody = await response.text();
      }

      const result = {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseBody.slice(0, 50000),
        truncated: responseBody.length > 50000,
        attempt: attempt + 1,
        cached: false,
      };

      const resultString = JSON.stringify(result, null, 2);
      
      // Cache successful GET requests
      if (cache && method.toUpperCase() === "GET" && response.ok) {
        setCachedResponse(cacheKey, resultString);
        const cachedResult = JSON.parse(resultString);
        cachedResult.cached = false;
        return JSON.stringify(cachedResult, null, 2);
      }
      
      return resultString;
    } catch (err: any) {
      lastError = err;
      
      // Don't retry on abort errors (timeout)
      if (err.name === "AbortError") {
        return JSON.stringify({ error: "Request timed out" }, null, 2);
      }
      
      // Don't retry on last attempt
      if (attempt === retryCount) {
        break;
      }
      
      // Exponential backoff
      const delay = retryDelay * Math.pow(2, attempt);
      await sleep(delay);
    }
  }

  return JSON.stringify({ error: lastError?.message || "Request failed" }, null, 2);
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
