import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyHrSession, HR_COOKIE } from "@/lib/hrSession";
import { checkIn, checkOut } from "@/lib/attendance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Employee check-in / check-out. Body: { action: "in" | "out" }.
export async function POST(req: Request) {
  const token = cookies().get(HR_COOKIE)?.value;
  const userId = await verifyHrSession(token);
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const { action } = await req.json() as { action?: "in" | "out" };
    if (action !== "in" && action !== "out") {
      return NextResponse.json({ error: "action must be 'in' or 'out'." }, { status: 400 });
    }
    const record = action === "in" ? await checkIn(userId) : await checkOut(userId);
    return NextResponse.json({ ok: true, action, record });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
