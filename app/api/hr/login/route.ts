import { NextResponse } from "next/server";
import { verifyHrCredentials, publicUser } from "@/lib/hrUsers";
import { signHrSession, HR_COOKIE, HR_COOKIE_MAX_AGE } from "@/lib/hrSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { id, password } = await req.json() as { id?: string; password?: string };
    if (!id || !password) {
      return NextResponse.json({ error: "Enter your ID and password." }, { status: 400 });
    }
    const user = await verifyHrCredentials(id, password);
    if (!user) {
      return NextResponse.json({ error: "Incorrect ID or password." }, { status: 401 });
    }
    const token = await signHrSession(user.id);
    const res = NextResponse.json({ ok: true, user: publicUser(user) });
    res.cookies.set(HR_COOKIE, token, {
      maxAge: HR_COOKIE_MAX_AGE,
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: true,
    });
    return res;
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
