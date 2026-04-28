// Shared Guesty access-token helper, factored out of lib/guesty.ts so it can
// be reused by other endpoints (reviews, etc.) without circular imports.
import { promises as fs } from "fs";
import path from "path";
import { Redis } from "@upstash/redis";

const TOKEN_URL = "https://open-api.guesty.com/oauth2/token";

const redis = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
  ? new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    })
  : null;
const REDIS_KEY = "guesty:access-token";

const TOKEN_CACHE_PATH = process.env.VERCEL
  ? path.join("/tmp", "guesty-token.json")
  : path.join(process.cwd(), ".cache", "guesty-token.json");

interface CachedToken { token: string; expiresAt: number }
let memoryToken: CachedToken | null = null;

async function readDisk(): Promise<CachedToken | null> {
  try {
    const raw = await fs.readFile(TOKEN_CACHE_PATH, "utf8");
    const parsed = JSON.parse(raw) as CachedToken;
    if (parsed.expiresAt > Date.now()) return parsed;
    return null;
  } catch { return null; }
}

async function writeDisk(t: CachedToken) {
  await fs.mkdir(path.dirname(TOKEN_CACHE_PATH), { recursive: true });
  await fs.writeFile(TOKEN_CACHE_PATH, JSON.stringify(t), "utf8");
}

export async function fetchGuestyToken(): Promise<string> {
  if (memoryToken && memoryToken.expiresAt > Date.now()) return memoryToken.token;

  if (redis) {
    try {
      const stored = await redis.get<CachedToken>(REDIS_KEY);
      if (stored && stored.expiresAt > Date.now()) {
        memoryToken = stored;
        return stored.token;
      }
    } catch { /* fall through */ }
  }

  const env = process.env.GUESTY_BOOTSTRAP_TOKEN;
  const envExp = Number(process.env.GUESTY_BOOTSTRAP_TOKEN_EXPIRES_AT);
  if (env && Number.isFinite(envExp) && envExp > Date.now()) {
    memoryToken = { token: env, expiresAt: envExp };
    if (redis) { try { await redis.set(REDIS_KEY, memoryToken); } catch { /* ignore */ } }
    return env;
  }

  const disk = await readDisk();
  if (disk) { memoryToken = disk; return disk.token; }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: "open-api",
    client_id: process.env.GUESTY_CLIENT_ID!,
    client_secret: process.env.GUESTY_CLIENT_SECRET!,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) {
      const retry = Number(res.headers.get("retry-after") ?? 0);
      const reset = new Date(Date.now() + retry * 1000).toLocaleString();
      throw new Error(`Guesty token endpoint rate-limited (5/day). Resets at ~${reset}. Body: ${text}`);
    }
    throw new Error(`Guesty token request failed: ${res.status} — ${text}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  const t: CachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in - 300) * 1000,
  };
  memoryToken = t;
  if (redis) { try { await redis.set(REDIS_KEY, t); } catch { /* ignore */ } }
  await writeDisk(t);
  return t.token;
}
