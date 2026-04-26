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
