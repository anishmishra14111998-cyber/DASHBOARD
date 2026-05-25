import { NextResponse } from "next/server";
import { getAttendance, openRecord, workedMs, type AttendanceRecord } from "@/lib/attendance";
import { HR_USERS } from "@/lib/hrUsers";
import { nyToday, nyWeekStartIso } from "@/lib/datetime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Master attendance view for the owner dashboard. Stays behind basic auth
// (this path is NOT carved out of the middleware). Returns per-employee
// status + today's and this-week's worked hours.
export interface AttendanceUserSummary {
  id: string;
  name: string;
  checkedIn: boolean;
  since: string | null;        // ISO check-in time of the open record
  todayHours: number;          // worked hours today (incl. open record)
  weekHours: number;           // worked hours this week (Mon-start)
  lastCheckOut: string | null; // ISO of most recent completed checkout
  todayRecords: AttendanceRecord[];
}

export async function GET() {
  const store = await getAttendance();
  const today = nyToday();
  const weekStart = nyWeekStartIso();

  const users: AttendanceUserSummary[] = HR_USERS.map((u) => {
    const recs = store[u.id] ?? [];
    const open = openRecord(recs);

    let todayMs = 0, weekMs = 0, lastCheckOut: string | null = null;
    for (const r of recs) {
      if (r.date === today) todayMs += workedMs(r);
      if (r.date >= weekStart && r.date <= today) weekMs += workedMs(r);
      if (r.checkOutAt && (!lastCheckOut || r.checkOutAt > lastCheckOut)) lastCheckOut = r.checkOutAt;
    }
    return {
      id: u.id,
      name: u.name,
      checkedIn: !!open,
      since: open?.checkInAt ?? null,
      todayHours: Math.round((todayMs / 3_600_000) * 100) / 100,
      weekHours: Math.round((weekMs / 3_600_000) * 100) / 100,
      lastCheckOut,
      todayRecords: recs.filter((r) => r.date === today)
        .sort((a, b) => (a.checkInAt < b.checkInAt ? 1 : -1)),
    };
  });

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    today,
    weekStart,
    users,
  });
}
