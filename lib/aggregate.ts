import type { Channel, Reservation } from "./types";
import {
  addDaysIso,
  daysBetweenIso,
  nyMonthLabel,
  nyNextMonthRange,
  nyToday,
  type DateRange,
} from "./datetime";

function isOccupiedOn(r: Reservation, day: string): boolean {
  return r.status === "confirmed" && r.checkIn <= day && day < r.checkOut;
}

function nightlySplit(r: Reservation) {
  const n = Math.max(1, r.nights);
  return {
    netAccommodation: r.netAccommodation / n,
    cleaningFare: r.cleaningFare / n,
    otherFees: r.otherFees / n,
    taxes: r.taxes / n,
    grossRevenue: r.grossRevenue / n,
    commission: r.channelCommission / n,
    netPayout: r.netPayout / n,
  };
}

// Inclusive end → exclusive end for half-open interval math.
function exclusiveEnd(range: DateRange): string {
  return addDaysIso(range.end, 1);
}

// ---- Today snapshot (always literal today, never period-filtered) ------

export interface TodaySnapshot {
  totalProperties: number;
  occupied: number;
  vacant: number;
  occupancyPct: number;
  todayRevenue: number;
  todayCommission: number;
  todayNet: number;
  newBookingsToday: number;
}

export function buildTodaySnapshot(
  reservations: Reservation[],
  propertyCount: number
): TodaySnapshot {
  const today = nyToday();
  let revenue = 0;
  let commission = 0;
  let netPayout = 0;
  const occupiedSet = new Set<string>();
  let newBookings = 0;

  for (const r of reservations) {
    if (r.status !== "confirmed") continue;
    if (r.checkIn === today) newBookings += 1;
    if (!isOccupiedOn(r, today)) continue;
    occupiedSet.add(r.propertyId);
    const ns = nightlySplit(r);
    revenue += ns.grossRevenue;
    commission += ns.commission;
    netPayout += ns.netPayout;
  }

  const occupied = occupiedSet.size;
  return {
    totalProperties: propertyCount,
    occupied,
    vacant: Math.max(0, propertyCount - occupied),
    occupancyPct: propertyCount ? Math.round((occupied / propertyCount) * 100) : 0,
    todayRevenue: Math.round(revenue),
    todayCommission: Math.round(commission),
    todayNet: Math.round(netPayout),
    newBookingsToday: newBookings,
  };
}

// ---- Period summary + three-basis breakdown ---------------------------

export interface PeriodBasis {
  label: string;
  description: string;
  bookings: number;
  nights?: number;
  netAccommodation: number;
  cleaningFare: number;
  otherFees: number;
  taxes: number;
  grossRevenue: number;
  commission: number;
  commissionPct: number;
  netPayout: number;
}

export interface PeriodBases {
  rangeLabel: string;          // "This week" / "Month to date"
  rangeStart: string;          // YYYY-MM-DD
  rangeEnd: string;            // YYYY-MM-DD
  monthLabel: string;          // for the MTD-style header
  daysInRange: number;
  totalNightsAvailable: number;
  occupancyPct: number;
  stayedNights: PeriodBasis;
  checkOut: PeriodBasis;
  checkIn: PeriodBasis;
}

function emptyBasis(label: string, description: string): PeriodBasis {
  return {
    label, description, bookings: 0,
    netAccommodation: 0, cleaningFare: 0, otherFees: 0, taxes: 0,
    grossRevenue: 0, commission: 0, commissionPct: 0, netPayout: 0,
  };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function finalize(b: PeriodBasis): PeriodBasis {
  return {
    ...b,
    netAccommodation: r2(b.netAccommodation),
    cleaningFare: r2(b.cleaningFare),
    otherFees: r2(b.otherFees),
    taxes: r2(b.taxes),
    grossRevenue: r2(b.grossRevenue),
    commission: r2(b.commission),
    netPayout: r2(b.netPayout),
    commissionPct:
      b.grossRevenue > 0
        ? Math.round((b.commission / b.grossRevenue) * 10000) / 100
        : 0,
  };
}

export function buildPeriodBases(
  reservations: Reservation[],
  propertyCount: number,
  range: DateRange
): PeriodBases {
  const rangeStart = range.start;
  const rangeEndExclusive = exclusiveEnd(range);
  const daysInRange = daysBetweenIso(range.start, range.end) + 1;

  const stayed = emptyBasis(
    "Stayed-nights",
    `Apportioned by nights occupied within ${range.start} → ${range.end}`
  );
  const checkOut = emptyBasis(
    "Check-out basis",
    `Reservations whose checkout falls within ${range.start} → ${range.end}`
  );
  const checkIn = emptyBasis(
    "Check-in basis",
    `Reservations whose check-in falls within ${range.start} → ${range.end}`
  );
  let stayedNightsTotal = 0;

  for (const r of reservations) {
    if (r.status !== "confirmed") continue;

    // 1. Stayed-nights (apportion across nights in window)
    const inStart = r.checkIn > rangeStart ? r.checkIn : rangeStart;
    const inEnd = r.checkOut < rangeEndExclusive ? r.checkOut : rangeEndExclusive;
    if (inStart < inEnd) {
      const nightsInWindow = daysBetweenIso(inStart, inEnd);
      const ratio = nightsInWindow / Math.max(1, r.nights);
      stayed.netAccommodation += r.netAccommodation * ratio;
      stayed.cleaningFare    += r.cleaningFare * ratio;
      stayed.otherFees       += r.otherFees * ratio;
      stayed.taxes           += r.taxes * ratio;
      stayed.grossRevenue    += r.grossRevenue * ratio;
      stayed.commission      += r.channelCommission * ratio;
      stayed.netPayout       += r.netPayout * ratio;
      stayed.bookings        += 1;
      stayedNightsTotal      += nightsInWindow;
    }

    // 2. Check-out basis
    if (r.checkOut >= range.start && r.checkOut <= range.end) {
      checkOut.netAccommodation += r.netAccommodation;
      checkOut.cleaningFare    += r.cleaningFare;
      checkOut.otherFees       += r.otherFees;
      checkOut.taxes           += r.taxes;
      checkOut.grossRevenue    += r.grossRevenue;
      checkOut.commission      += r.channelCommission;
      checkOut.netPayout       += r.netPayout;
      checkOut.bookings        += 1;
    }

    // 3. Check-in basis
    if (r.checkIn >= range.start && r.checkIn <= range.end) {
      checkIn.netAccommodation += r.netAccommodation;
      checkIn.cleaningFare    += r.cleaningFare;
      checkIn.otherFees       += r.otherFees;
      checkIn.taxes           += r.taxes;
      checkIn.grossRevenue    += r.grossRevenue;
      checkIn.commission      += r.channelCommission;
      checkIn.netPayout       += r.netPayout;
      checkIn.bookings        += 1;
    }
  }

  stayed.nights = stayedNightsTotal;
  const totalNightsAvailable = propertyCount * daysInRange;

  return {
    rangeLabel: range.label,
    rangeStart: range.start,
    rangeEnd: range.end,
    monthLabel: nyMonthLabel(),
    daysInRange,
    totalNightsAvailable,
    occupancyPct: totalNightsAvailable
      ? Math.round((stayedNightsTotal / totalNightsAvailable) * 100)
      : 0,
    stayedNights: finalize(stayed),
    checkOut: finalize(checkOut),
    checkIn: finalize(checkIn),
  };
}

// ---- Next month forecast (revenue already booked + forecasted occupancy) ---

export interface NextMonthForecast {
  monthLabel: string;
  start: string;
  end: string;
  daysInMonth: number;
  totalProperties: number;
  bookings: number;
  occupiedNights: number;
  totalNightsAvailable: number;
  occupancyPct: number;
  bookedRevenue: number;       // gross
  bookedNetPayout: number;
  bookedCommission: number;
  adr: number;                 // gross / occupied nights
}

export function buildNextMonthForecast(
  reservations: Reservation[],
  propertyCount: number
): NextMonthForecast {
  const r = nyNextMonthRange();
  const startInclusive = r.start;
  const endExclusive = addDaysIso(r.end, 1);
  const daysInMonth = daysBetweenIso(r.start, r.end) + 1;

  let occupiedNights = 0;
  let bookedRevenue = 0;
  let bookedNet = 0;
  let bookedCommission = 0;
  const bookingIds = new Set<string>();

  for (const res of reservations) {
    if (res.status !== "confirmed") continue;
    const inStart = res.checkIn > startInclusive ? res.checkIn : startInclusive;
    const inEnd   = res.checkOut < endExclusive ? res.checkOut : endExclusive;
    if (inStart >= inEnd) continue;

    const nightsInWindow = daysBetweenIso(inStart, inEnd);
    const ratio = nightsInWindow / Math.max(1, res.nights);
    occupiedNights   += nightsInWindow;
    bookedRevenue    += res.grossRevenue * ratio;
    bookedNet        += res.netPayout * ratio;
    bookedCommission += res.channelCommission * ratio;
    bookingIds.add(res.id);
  }

  const totalNightsAvailable = propertyCount * daysInMonth;
  return {
    monthLabel: r.label,
    start: r.start,
    end: r.end,
    daysInMonth,
    totalProperties: propertyCount,
    bookings: bookingIds.size,
    occupiedNights,
    totalNightsAvailable,
    occupancyPct: totalNightsAvailable
      ? Math.round((occupiedNights / totalNightsAvailable) * 100)
      : 0,
    bookedRevenue: Math.round(bookedRevenue),
    bookedNetPayout: Math.round(bookedNet),
    bookedCommission: Math.round(bookedCommission),
    adr: occupiedNights > 0 ? Math.round(bookedRevenue / occupiedNights) : 0,
  };
}

// ---- Daily series (one point per day in range) ------------------------

export interface DailyPoint {
  date: string;
  label: string;
  revenue: number;
  commission: number;
  netRevenue: number;
  occupied: number;
  vacant: number;
  occupancyPct: number;
}

// Cap chart density so very long ranges stay legible.
const MAX_DAILY_POINTS = 90;

export function buildDailySeries(
  reservations: Reservation[],
  propertyCount: number,
  range: DateRange
): DailyPoint[] {
  const totalDays = daysBetweenIso(range.start, range.end) + 1;
  const points: DailyPoint[] = [];

  // For ranges longer than MAX_DAILY_POINTS, we'd downsample — for now just truncate
  // to the most recent MAX_DAILY_POINTS days so the chart stays readable.
  const days = Math.min(totalDays, MAX_DAILY_POINTS);
  const start = totalDays > MAX_DAILY_POINTS ? addDaysIso(range.end, -(days - 1)) : range.start;

  for (let i = 0; i < days; i++) {
    const day = addDaysIso(start, i);
    const labelDate = new Date(`${day}T12:00:00Z`);
    let revenue = 0;
    let commission = 0;
    let netPayout = 0;
    const occupiedSet = new Set<string>();

    for (const r of reservations) {
      if (!isOccupiedOn(r, day)) continue;
      occupiedSet.add(r.propertyId);
      const ns = nightlySplit(r);
      revenue += ns.grossRevenue;
      commission += ns.commission;
      netPayout += ns.netPayout;
    }

    const occupied = occupiedSet.size;
    points.push({
      date: day,
      label: labelDate.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }),
      revenue: Math.round(revenue),
      commission: Math.round(commission),
      netRevenue: Math.round(netPayout),
      occupied,
      vacant: Math.max(0, propertyCount - occupied),
      occupancyPct: propertyCount ? Math.round((occupied / propertyCount) * 100) : 0,
    });
  }
  return points;
}

// ---- Channel commission (filtered to range, by check-in date) ---------

export interface ChannelCommissionPoint {
  channel: Channel;
  bookings: number;
  gross: number;
  commission: number;
  commissionPct: number;
  net: number;
}

export function buildChannelCommission(
  reservations: Reservation[],
  range?: DateRange
): ChannelCommissionPoint[] {
  const map = new Map<Channel, { bookings: number; gross: number; commission: number; netPayout: number }>();
  for (const r of reservations) {
    if (r.status !== "confirmed") continue;
    if (range && (r.checkIn < range.start || r.checkIn > range.end)) continue;
    const prev = map.get(r.channel) ?? { bookings: 0, gross: 0, commission: 0, netPayout: 0 };
    prev.bookings += 1;
    prev.gross += r.grossRevenue;
    prev.commission += r.channelCommission;
    prev.netPayout += r.netPayout;
    map.set(r.channel, prev);
  }
  return [...map.entries()]
    .map(([channel, v]) => ({
      channel,
      bookings: v.bookings,
      gross: Math.round(v.gross),
      commission: Math.round(v.commission),
      net: Math.round(v.netPayout),
      commissionPct: v.gross > 0 ? Math.round((v.commission / v.gross) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.gross - a.gross);
}
