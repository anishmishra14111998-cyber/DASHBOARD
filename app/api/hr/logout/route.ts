import { NextResponse } from "next/server";
import { HR_COOKIE } from "@/lib/hrSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(HR_COOKIE, "", { maxAge: 0, path: "/" });
  return res;
}
