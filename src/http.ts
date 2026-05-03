// BlackWhite — MCP DevKit

interface HttpRequestInput {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
}

export async function httpRequest(input: HttpRequestInput): Promise<string> {
  const { url, method = "GET", headers = {}, body, timeout = 30000 } = input;

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
    };

    return JSON.stringify(result, null, 2);
  } catch (err: any) {
    if (err.name === "AbortError") {
      return JSON.stringify({ error: "Request timed out" }, null, 2);
    }
    return JSON.stringify({ error: err.message }, null, 2);
  }
}
