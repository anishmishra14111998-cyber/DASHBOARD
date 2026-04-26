// All date math runs in America/New_York time so the dashboard reflects the
// operator's local "today", not the server's UTC clock.
export const TZ = "America/New_York";

const partsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function partsOf(d: Date) {
  const out = partsFmt.formatToParts(d);
  return {
    year: out.find((p) => p.type === "year")!.value,
    month: out.find((p) => p.type === "month")!.value,
    day: out.find((p) => p.type === "day")!.value,
  };
}

export function nyToday(d: Date = new Date()): string {
  const p = partsOf(d);
  return `${p.year}-${p.month}-${p.day}`;
}

export function nyDayOfMonth(d: Date = new Date()): number {
  return Number(partsOf(d).day);
}

export function nyMonthStartIso(d: Date = new Date()): string {
  const p = partsOf(d);
  return `${p.year}-${p.month}-01`;
}

// Add `n` days to an ISO date (YYYY-MM-DD). DST-safe via UTC noon arithmetic.
export function addDaysIso(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function nyMonthLabel(d: Date = new Date()): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: TZ,
    month: "long",
    year: "numeric",
  }).format(d);
}

export function nyTimeLabel(d: Date = new Date()): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(d);
}

export function nyWeekdayDateLabel(d: Date = new Date()): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: TZ,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(d);
}

// Diff in whole days between two YYYY-MM-DD strings. Positive when b > a.
export function daysBetweenIso(a: string, b: string): number {
  const ms = new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

// ---- Date-range helpers (NY tz) ----------------------------------------

const weekdayFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  weekday: "short",
});

// Returns 0=Sun .. 6=Sat for the NY weekday of `d`.
function nyWeekday(d: Date = new Date()): number {
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[weekdayFmt.format(d)];
}

// Monday-start week (international + hospitality standard).
export function nyWeekStartIso(d: Date = new Date()): string {
  const today = nyToday(d);
  const wd = nyWeekday(d); // 0..6 (Sun..Sat)
  const back = wd === 0 ? 6 : wd - 1; // days back to Monday
  return addDaysIso(today, -back);
}

export function nyLastMonthRange(d: Date = new Date()): { start: string; end: string } {
  const today = nyToday(d);
  const [y, m] = today.split("-").map(Number);
  const prevMonth = m === 1 ? 12 : m - 1;
  const prevYear = m === 1 ? y - 1 : y;
  const start = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();
  const end = `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

export type PresetId =
  | "today"
  | "yesterday"
  | "this-week"
  | "last-7"
  | "this-month"
  | "last-month"
  | "last-30"
  | "last-90";

export interface DateRange {
  start: string;        // YYYY-MM-DD, inclusive
  end: string;          // YYYY-MM-DD, inclusive
  label: string;        // human label, e.g. "This week"
  preset?: PresetId;
}

export function rangeForPreset(preset: PresetId): DateRange {
  const today = nyToday();
  switch (preset) {
    case "today":
      return { start: today, end: today, label: "Today", preset };
    case "yesterday": {
      const y = addDaysIso(today, -1);
      return { start: y, end: y, label: "Yesterday", preset };
    }
    case "this-week":
      return { start: nyWeekStartIso(), end: today, label: "This week", preset };
    case "last-7":
      return { start: addDaysIso(today, -6), end: today, label: "Last 7 days", preset };
    case "this-month":
      return { start: nyMonthStartIso(), end: today, label: "Month to date", preset };
    case "last-month": {
      const r = nyLastMonthRange();
      return { ...r, label: "Last month", preset };
    }
    case "last-30":
      return { start: addDaysIso(today, -29), end: today, label: "Last 30 days", preset };
    case "last-90":
      return { start: addDaysIso(today, -89), end: today, label: "Last 90 days", preset };
  }
}

export function rangeLengthDays(r: DateRange): number {
  return daysBetweenIso(r.start, r.end) + 1;
}
