import { Redis } from "@upstash/redis";
import { nyToday } from "./datetime";

// Employee attendance store (check-in / check-out) in Upstash Redis,
// keyed per user. All dates are America/New_York calendar days.

const redis = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
  ? new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN })
  : null;

const KEY = "hr:attendance:v1";

export interface AttendanceRecord {
  date: string;             // YYYY-MM-DD (ET) of check-in
  checkInAt: string;        // ISO
  checkOutAt: string | null;// ISO, null while still clocked in
}

export type AttendanceStore = Record<string, AttendanceRecord[]>;

export async function getAttendance(): Promise<AttendanceStore> {
  if (!redis) return {};
  try { return (await redis.get<AttendanceStore>(KEY)) ?? {}; }
  catch { return {}; }
}

async function save(store: AttendanceStore): Promise<void> {
  if (!redis) throw new Error("Redis not configured");
  await redis.set(KEY, store);
}

// The currently-open (not yet checked-out) record, if any.
export function openRecord(records: AttendanceRecord[] | undefined): AttendanceRecord | undefined {
  return (records ?? []).find((r) => r.checkOutAt === null);
}

export async function checkIn(userId: string): Promise<AttendanceRecord> {
  const store = await getAttendance();
  const recs = store[userId] ?? [];
  if (openRecord(recs)) throw new Error("You're already checked in.");
  const rec: AttendanceRecord = {
    date: nyToday(),
    checkInAt: new Date().toISOString(),
    checkOutAt: null,
  };
  recs.push(rec);
  store[userId] = recs;
  await save(store);
  return rec;
}

export async function checkOut(userId: string): Promise<AttendanceRecord> {
  const store = await getAttendance();
  const recs = store[userId] ?? [];
  const open = openRecord(recs);
  if (!open) throw new Error("You're not checked in.");
  open.checkOutAt = new Date().toISOString();
  store[userId] = recs;
  await save(store);
  return open;
}

// Worked milliseconds for a record (uses now() if still open).
export function workedMs(r: AttendanceRecord): number {
  const end = r.checkOutAt ? new Date(r.checkOutAt).getTime() : Date.now();
  return Math.max(0, end - new Date(r.checkInAt).getTime());
}
