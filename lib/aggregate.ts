import type { Channel, Reservation } from "./types";
import {
  addDaysIso,
  daysBetweenIso,
  nyDayOfMonth,
  nyMonthLabel,
  nyMonthStartIso,
  nyToday,
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

export interface MtdBasis {
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

export interface MtdBases {
  monthLabel: string;
  daysElapsed: number;
  totalNightsAvailable: number;
  occupancyPct: number;
  stayedNights: MtdBasis;
  checkOut: MtdBasis;
  checkIn: MtdBasis;
}

function emptyBasis(label: string, description: string): MtdBasis {
  return {
    label, description, bookings: 0,
    netAccommodation: 0, cleaningFare: 0, otherFees: 0, taxes: 0,
    grossRevenue: 0, commission: 0, commissionPct: 0, netPayout: 0,
  };
}

function finalize(b: MtdBasis): MtdBasis {
  return {
    ...b,
    netAccommodation: round2(b.netAccommodation),
    cleaningFare: round2(b.cleaningFare),
    otherFees: round2(b.otherFees),
    taxes: round2(b.taxes),
    grossRevenue: round2(b.grossRevenue),
    commission: round2(b.commission),
    netPayout: round2(b.netPayout),
    commissionPct:
      b.grossRevenue > 0
        ? Math.round((b.commission / b.grossRevenue) * 10000) / 100
        : 0,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function buildMtdBases(
  reservations: Reservation[],
  propertyCount: number
): MtdBases {
  const today = nyToday();
  const monthStartIso = nyMonthStartIso();
  const tomorrow = addDaysIso(today, 1);
  const daysElapsed = nyDayOfMonth();

  const stayed = emptyBasis(
    "Stayed-nights",
    `Apportioned by nights occupied within ${monthStartIso} → ${today}`
  );
  const checkOut = emptyBasis(
    "Check-out basis",
    `Reservations whose checkout falls within ${monthStartIso} → ${today}`
  );
  const checkIn = emptyBasis(
    "Check-in basis",
    `Reservations whose check-in falls within ${monthStartIso} → ${today}`
  );
  let stayedNightsTotal = 0;

  for (const r of reservations) {
    if (r.status !== "confirmed") continue;

    // 1. Stayed-nights basis (apportion across nights in window)
    const inStart = r.checkIn > monthStartIso ? r.checkIn : monthStartIso;
    const inEnd = r.checkOut < tomorrow ? r.checkOut : tomorrow;
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

    // 2. Check-out basis (full reservation if checkout in window)
    if (r.checkOut >= monthStartIso && r.checkOut <= today) {
      checkOut.netAccommodation += r.netAccommodation;
      checkOut.cleaningFare    += r.cleaningFare;
      checkOut.otherFees       += r.otherFees;
      checkOut.taxes           += r.taxes;
      checkOut.grossRevenue    += r.grossRevenue;
      checkOut.commission      += r.channelCommission;
      checkOut.netPayout       += r.netPayout;
      checkOut.bookings        += 1;
    }

    // 3. Check-in basis (full reservation if check-in in window)
    if (r.checkIn >= monthStartIso && r.checkIn <= today) {
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
  const totalNightsAvailable = propertyCount * daysElapsed;

  return {
    monthLabel: nyMonthLabel(),
    daysElapsed,
    totalNightsAvailable,
    occupancyPct: totalNightsAvailable
      ? Math.round((stayedNightsTotal / totalNightsAvailable) * 100)
      : 0,
    stayedNights: finalize(stayed),
    checkOut: finalize(checkOut),
    checkIn: finalize(checkIn),
  };
}

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

export function buildDailySeries(
  reservations: Reservation[],
  propertyCount: number,
  days = 30
): DailyPoint[] {
  const today = nyToday();
  const points: DailyPoint[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const day = addDaysIso(today, -i);
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

export interface ChannelCommissionPoint {
  channel: Channel;
  bookings: number;
  gross: number;
  commission: number;
  commissionPct: number;
  net: number;
}

export function buildChannelCommission(
  reservations: Reservation[]
): ChannelCommissionPoint[] {
  const map = new Map<Channel, { bookings: number; gross: number; commission: number; netPayout: number }>();
  for (const r of reservations) {
    if (r.status !== "confirmed") continue;
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
