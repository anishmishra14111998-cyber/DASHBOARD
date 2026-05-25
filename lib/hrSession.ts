// Signed session token for the HR time-clock. Format:
//   `${userId}.${expiryUnixSeconds}.${hmac}`
// The HMAC binds userId+expiry to a server secret so the cookie can't be
// forged. Works in both Edge and Node runtimes (Web Crypto).

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export const HR_COOKIE = "hr-session";

function sessionSecret(): string {
  return process.env.CRON_SECRET ?? process.env.DASHBOARD_PASS ?? "insecure-dev-secret";
}

async function hmacHex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function signHrSession(userId: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `${userId}.${exp}`;
  const sig = await hmacHex(payload, sessionSecret());
  return `${payload}.${sig}`;
}

// Returns the userId if the token is valid and unexpired, else null.
export async function verifyHrSession(token: string | undefined | null): Promise<string | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expStr, sig] = parts;
  const exp = parseInt(expStr, 10);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;
  const expected = await hmacHex(`${userId}.${exp}`, sessionSecret());
  return sig === expected ? userId : null;
}

export const HR_COOKIE_MAX_AGE = SESSION_TTL_SECONDS;
