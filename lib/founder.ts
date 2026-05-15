import { fetchGuesty, fetchListingNamesAll } from "@/lib/guesty";
import { fetchReviews } from "@/lib/reviews";
import {
  addDaysIso,
  daysBetweenIso,
  nyMonthLabel,
  nyMonthStartIso,
  nyToday,
} from "@/lib/datetime";

// Founder's monthly gross-revenue goal. Edit this single constant to retune
// the "Pacing vs Target" card on the Founder Update page.
export const MONTHLY_REVENUE_TARGET = 150_000;

export interface PickupBlock {
  yesterdayDate: string;
  yesterdayRevenue: number;
  yesterdayBookings: number;
  monthLabel: string;
  monthStart: string;
  daysInMonth: number;
  daysElapsed: number;
  target: number;
  expectedPace: number;             // pro-rata expected MTD
  actualMtdRevenue: number;         // stays-basis MTD revenue
  variance: number;                 // actual - expected
  paceStatus: "ahead" | "behind" | "on-track";
  pctOfTarget: number;
}

export interface OccupancyBlock {
  start: string;
  end: string;
  days: number;
  totalProperties: number;
  totalNightsAvailable: number;
  occupiedNights: number;
  occupancyPct: number;             // one decimal
}

export interface ReviewBlock {
  windowStart: string;
  windowEnd: string;
  count: number;
  avg: number;                      // 0..5
  prevCount: number;
  prevAvg: number;
  delta: number;                    // avg - prevAvg
}

export interface FounderSnapshot {
  generatedAt: string;
  pickup: PickupBlock;
  occupancy: OccupancyBlock;
  reviews: ReviewBlock;
}

export async function buildFounderSnapshot(): Promise<FounderSnapshot> {
  // Fetch Guesty + listing names in parallel, then reviews (uses names).
  const [guesty, names] = await Promise.all([fetchGuesty(), fetchListingNamesAll()]);
  const reviewsRes = await fetchReviews(names);

  const today      = nyToday();
  const yesterday  = addDaysIso(today, -1);
  const monthStart = nyMonthStartIso();
  const [y, m]     = monthStart.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const daysElapsed = daysBetweenIso(monthStart, today) + 1;
  const monthEndExclusive = addDaysIso(today, 1);

  // ---- 1. Yesterday pickup + MTD stayed-revenue ----
  let yesterdayRevenue  = 0;
  let yesterdayBookings = 0;
  let mtdRevenue        = 0;

  for (const r of guesty.reservations) {
    if (r.status !== "confirmed") continue;

    // "Pickup" = bookings *made* yesterday, by Guesty createdAt date (NY).
    const bookedDate = r.createdAt ? r.createdAt.slice(0, 10) : null;
    if (bookedDate === yesterday) {
      yesterdayRevenue  += r.grossRevenue;
      yesterdayBookings += 1;
    }

    // MTD: apportion gross by nights occupied within month-to-date.
    const inStart = r.checkIn  > monthStart        ? r.checkIn  : monthStart;
    const inEnd   = r.checkOut < monthEndExclusive ? r.checkOut : monthEndExclusive;
    if (inStart < inEnd) {
      const nightsInWindow = daysBetweenIso(inStart, inEnd);
      const ratio = nightsInWindow / Math.max(1, r.nights);
      mtdRevenue += r.grossRevenue * ratio;
    }
  }

  const expectedPace = MONTHLY_REVENUE_TARGET * (daysElapsed / daysInMonth);
  const variance     = mtdRevenue - expectedPace;
  // ±1% of the target = "on-track" deadband so we don't flicker red/green over rounding.
  const deadband = MONTHLY_REVENUE_TARGET * 0.01;
  const paceStatus: PickupBlock["paceStatus"] =
    Math.abs(variance) < deadband ? "on-track" : variance > 0 ? "ahead" : "behind";
  const pctOfTarget = (mtdRevenue / MONTHLY_REVENUE_TARGET) * 100;

  // ---- 2. Forward 30-day occupancy ----
  const forwardStart          = today;
  const forwardEnd            = addDaysIso(today, 29);
  const forwardEndExclusive   = addDaysIso(forwardEnd, 1);
  let   occupiedNights        = 0;

  for (const r of guesty.reservations) {
    if (r.status !== "confirmed") continue;
    const inStart = r.checkIn  > forwardStart        ? r.checkIn  : forwardStart;
    const inEnd   = r.checkOut < forwardEndExclusive ? r.checkOut : forwardEndExclusive;
    if (inStart < inEnd) occupiedNights += daysBetweenIso(inStart, inEnd);
  }

  const totalProperties      = guesty.properties.length;
  const totalNightsAvailable = totalProperties * 30;
  const occupancyPct = totalNightsAvailable > 0
    ? Math.round((occupiedNights / totalNightsAvailable) * 1000) / 10
    : 0;

  // ---- 3. Trailing 30-day review score (+ prior 30 days for trend) ----
  const reviewStart = addDaysIso(today, -29);
  const reviewEnd   = today;
  const prevStart   = addDaysIso(today, -59);
  const prevEnd     = addDaysIso(today, -30);

  let count = 0, sum = 0, prevCount = 0, prevSum = 0;
  for (const rv of reviewsRes.reviews) {
    if (rv.rating === null) continue;
    const date = rv.createdAt?.slice(0, 10);
    if (!date) continue;
    if (date >= reviewStart && date <= reviewEnd) {
      count += 1;
      sum   += rv.rating;
    } else if (date >= prevStart && date <= prevEnd) {
      prevCount += 1;
      prevSum   += rv.rating;
    }
  }

  const avg     = count     > 0 ? sum     / count     : 0;
  const prevAvg = prevCount > 0 ? prevSum / prevCount : 0;

  return {
    generatedAt: new Date().toISOString(),
    pickup: {
      yesterdayDate:     yesterday,
      yesterdayRevenue:  Math.round(yesterdayRevenue),
      yesterdayBookings,
      monthLabel:        nyMonthLabel(),
      monthStart,
      daysInMonth,
      daysElapsed,
      target:            MONTHLY_REVENUE_TARGET,
      expectedPace:      Math.round(expectedPace),
      actualMtdRevenue:  Math.round(mtdRevenue),
      variance:          Math.round(variance),
      paceStatus,
      pctOfTarget:       Math.round(pctOfTarget * 10) / 10,
    },
    occupancy: {
      start: forwardStart,
      end:   forwardEnd,
      days:  30,
      totalProperties,
      totalNightsAvailable,
      occupiedNights,
      occupancyPct,
    },
    reviews: {
      windowStart: reviewStart,
      windowEnd:   reviewEnd,
      count,
      avg:         Math.round(avg     * 100) / 100,
      prevCount,
      prevAvg:     Math.round(prevAvg * 100) / 100,
      delta:       Math.round((avg - prevAvg) * 100) / 100,
    },
  };
}
