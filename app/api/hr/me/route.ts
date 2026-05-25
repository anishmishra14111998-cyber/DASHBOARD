import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyHrSession, HR_COOKIE } from "@/lib/hrSession";
import { hrUserById, publicUser } from "@/lib/hrUsers";
import { getAttendance, openRecord } from "@/lib/attendance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Returns the logged-in employee + their current clock status.
export async function GET() {
  const token = cookies().get(HR_COOKIE)?.value;
  const userId = await verifyHrSession(token);
  if (!userId) return NextResponse.json({ user: null }, { status: 401 });

  const user = hrUserById(userId);
  if (!user) return NextResponse.json({ user: null }, { status: 401 });

  const store = await getAttendance();
  const records = store[userId] ?? [];
  const open = openRecord(records);
  // Most recent 10 records, newest first, for the employee's own history.
  const recent = [...records].sort((a, b) => (a.checkInAt < b.checkInAt ? 1 : -1)).slice(0, 10);

  return NextResponse.json({
    user: publicUser(user),
    checkedIn: !!open,
    since: open?.checkInAt ?? null,
    recent,
  });
}
