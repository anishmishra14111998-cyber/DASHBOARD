// HMAC-signed link token used by:
//   - the cron route to generate a one-link bypass for the Slack message
//   - the middleware to validate that token at the edge
//
// Web Crypto API works in both Node 19+ runtime and the Edge runtime,
// so this module is safe to import from either place.

const VALID_FOR_SECONDS = 60 * 60 * 24 * 7; // 7 days

async function hmacHex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Produces `${unixSeconds}.${hmacHex}` — the unix timestamp gates expiry,
// the hmac binds the timestamp to the server secret so it can't be forged.
export async function buildLinkToken(secret: string): Promise<string> {
  const ts = Math.floor(Date.now() / 1000);
  const sig = await hmacHex(String(ts), secret);
  return `${ts}.${sig}`;
}

export async function isValidLinkToken(token: string | null | undefined, secret: string): Promise<boolean> {
  if (!token) return false;
  const idx = token.indexOf(".");
  if (idx < 1) return false;
  const tsStr = token.slice(0, idx);
  const sig   = token.slice(idx + 1);
  const ts    = parseInt(tsStr, 10);
  if (isNaN(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (now - ts > VALID_FOR_SECONDS) return false;
  if (ts > now + 60) return false; // small clock-skew buffer
  const expected = await hmacHex(tsStr, secret);
  return sig === expected;
}
