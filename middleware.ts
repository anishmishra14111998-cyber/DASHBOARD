import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

export function middleware(req: NextRequest) {
  if (!process.env.DASHBOARD_USER || !process.env.DASHBOARD_PASS) {
    return new NextResponse("DASHBOARD_USER / DASHBOARD_PASS not set", { status: 503 });
  }

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
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
