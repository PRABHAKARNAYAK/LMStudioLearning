import "dotenv/config";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000";
const API_TOKEN = process.env.API_TOKEN ?? "";
const REQUEST_TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS ?? "15000", 10);

export async function callApi<T>(path: string, init?: RequestInit): Promise<{ data: T; status: number }> {
  const url = `${API_BASE_URL}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {}),
    ...((init?.headers as Record<string, string>) ?? {}),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, headers, signal: controller.signal });
    const text = await res.text();
    console.log(`API Response from ${url}:`, text);
    let json: any;
    try {
      if (text.trim().startsWith("<!DOCTYPE html") || /<pre[\s\S]*?>[\s\S]*?<\/pre>/i.test(text)) {
        const match = text.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
        json = match?.[1] ? JSON.parse(match[1]) : JSON.parse(text);
      } else {
        json = text ? JSON.parse(text) : null;
      }
    } catch {
      json = { raw: text };
    }

    if (!res.ok) {
      throw new Error(`API ${url} failed: ${res.status} ${res.statusText}
Body: ${text}`);
    }
    return { data: json as T, status: res.status };
  } finally {
    clearTimeout(timer);
  }
}
