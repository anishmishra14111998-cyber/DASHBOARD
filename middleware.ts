import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isValidLinkToken } from "@/lib/linkToken";

const COOKIE_NAME    = "dashboard-session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

// HTTP Basic Auth. Primary creds: DASHBOARD_USER / DASHBOARD_PASS.
// Extra users: DASHBOARD_EXTRA_USERS as comma-separated "user:pass" pairs.
function isAuthorised(user: string, pass: string): boolean {
  if (user === process.env.DASHBOARD_USER && pass === process.env.DASHBOARD_PASS) return true;
  const extra = process.env.DASHBOARD_EXTRA_USERS ?? "";
  for (const pair of extra.split(",")) {
    const sep = pair.indexOf(":");
    if (sep < 1) continue;
    if (user === pair.slice(0, sep) && pass === pair.slice(sep + 1)) return true;
  }
  return false;
}

export async function middleware(req: NextRequest) {
  if (!process.env.DASHBOARD_USER || !process.env.DASHBOARD_PASS) {
    return new NextResponse("DASHBOARD_USER / DASHBOARD_PASS not set", { status: 503 });
  }

  // Shared secret used to sign and verify magic-link tokens. Reuse CRON_SECRET
  // (already set in Vercel) so we don't have to manage another env var; fall
  // back to DASHBOARD_PASS so this still works if CRON_SECRET isn't set.
  const linkSecret = process.env.CRON_SECRET ?? process.env.DASHBOARD_PASS!;

  // 1. Existing session cookie — silent pass-through for any in-page request
  //    (including /api/* calls) once the founder has clicked the magic link.
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (cookie && await isValidLinkToken(cookie, linkSecret)) {
    return NextResponse.next();
  }

  // 2. Magic-link query token — first hit from the Slack message. Validate,
  //    set the cookie, and redirect to the same URL with `?auth=` stripped
  //    so the credentials don't sit in the address bar / browser history.
  const queryToken = req.nextUrl.searchParams.get("auth");
  if (queryToken && await isValidLinkToken(queryToken, linkSecret)) {
    const cleanUrl = new URL(req.url);
    cleanUrl.searchParams.delete("auth");
    const res = NextResponse.redirect(cleanUrl);
    res.cookies.set(COOKIE_NAME, queryToken, {
      maxAge:   COOKIE_MAX_AGE,
      path:     "/",
      httpOnly: true,
      sameSite: "lax",
      secure:   true,
    });
    return res;
  }

  // 3. Fall back to HTTP basic auth for people typing the URL directly.
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    const decoded = atob(auth.slice(6));
    const sep = decoded.indexOf(":");
    if (sep > 0 && isAuthorised(decoded.slice(0, sep), decoded.slice(sep + 1))) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Revenue Dashboard"' },
  });
}

export const config = {
  // Carve-outs from basic auth:
  //   api/cron/*           — Vercel cron runner can't send basic auth; uses CRON_SECRET.
  //   timeclock            — employee time-clock; gated by its own HR login.
  //   api/hr/login|me|clock|logout — employee HR endpoints; gated by HR session cookie.
  // NOTE: /hr (master dashboard) and /api/hr/attendance stay behind basic auth
  // so only the owner sees the team-wide view.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/cron|timeclock|api/hr/(?:login|me|clock|logout)).*)"],
};
