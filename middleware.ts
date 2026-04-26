import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// HTTP Basic Auth so the dashboard isn't readable by anyone who finds the URL.
// Credentials live in .env.local (DASHBOARD_USER / DASHBOARD_PASS).
export function middleware(req: NextRequest) {
  const expectedUser = process.env.DASHBOARD_USER;
  const expectedPass = process.env.DASHBOARD_PASS;

  // If creds aren't configured, refuse to serve — fail closed rather than open.
  if (!expectedUser || !expectedPass) {
    return new NextResponse(
      "DASHBOARD_USER / DASHBOARD_PASS not set in .env.local",
      { status: 503 }
    );
  }

  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    const decoded = atob(auth.slice(6));
    const sep = decoded.indexOf(":");
    if (sep > 0) {
      const user = decoded.slice(0, sep);
      const pass = decoded.slice(sep + 1);
      if (user === expectedUser && pass === expectedPass) {
        return NextResponse.next();
      }
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Revenue Dashboard"' },
  });
}

export const config = {
  // Apply to all routes except Next.js internals.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
