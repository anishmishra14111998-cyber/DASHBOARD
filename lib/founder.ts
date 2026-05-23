import { fetchGuesty, fetchListingNamesAll } from "@/lib/guesty";
import { fetchReviews } from "@/lib/reviews";
import {
  addDaysIso,
  daysBetweenIso,
  nyMonthLabel,
  nyMonthStartIso,
  nyNextMonthRange,
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

export interface TodayOccupancyBlock {
  date: string;
  totalProperties: number;
  occupied: number;
  vacant: number;
  occupancyPct: number;             // integer
}

export interface MonthOccupancyBlock {
  monthLabel: string;
  occupiedNights: number;           // confirmed nights overlapping the full calendar month
  totalNightsAvailable: number;     // properties × days in month
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

export interface NewBookingsBlock {
  monthLabel: string;
  count: number;       // reservations booked (createdAt) this month
  amount: number;      // sum of gross revenue of those bookings
}

export interface NextMonthBlock {
  monthLabel: string;
  bookedRevenue: number;   // gross, apportioned to nights falling in next month
  bookedNights: number;
  occupancyPct: number;    // one decimal
}

export interface AdvanceBlock {
  count: number;       // confirmed reservations with a future check-in
  revenue: number;     // gross value of all those future bookings
  throughDate: string; // furthest future checkout on the books
}

export interface FounderSnapshot {
  generatedAt: string;
  pickup: PickupBlock;
  todayOccupancy: TodayOccupancyBlock;
  monthOccupancy: MonthOccupancyBlock;
  occupancy: OccupancyBlock;
  reviews: ReviewBlock;
  newBookings: NewBookingsBlock;
  nextMonth: NextMonthBlock;
  advance: AdvanceBlock;
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
  const monthEndExclusive = addDaysIso(today, 1);          // MTD end (today + 1)
  const fullMonthEndExcl  = addDaysIso(monthStart, daysInMonth); // 1st of next month

  // ---- 1. Yesterday pickup + MTD stayed-revenue ----
  let yesterdayRevenue  = 0;
  let yesterdayBookings = 0;
  let mtdRevenue        = 0;

  for (const r of guesty.reservations) {
    if (r.status !== "confirmed") continue;

    // "Pickup" = bookings *made* yesterday, by Guesty createdAt date in NY
    // time (convert the UTC timestamp to the NY calendar day so late-night
    // bookings land on the right date).
    const bookedDate = r.createdAt ? nyToday(new Date(r.createdAt)) : null;
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

  // ---- 2. Forward 30-day occupancy + today's occupancy ----
  const forwardStart          = today;
  const forwardEnd            = addDaysIso(today, 29);
  const forwardEndExclusive   = addDaysIso(forwardEnd, 1);
  let   occupiedNights        = 0;
  let   monthOccNights        = 0;
  const occupiedTodaySet      = new Set<string>();

  for (const r of guesty.reservations) {
    if (r.status !== "confirmed") continue;
    // Forward 30 days
    const inStart = r.checkIn  > forwardStart        ? r.checkIn  : forwardStart;
    const inEnd   = r.checkOut < forwardEndExclusive ? r.checkOut : forwardEndExclusive;
    if (inStart < inEnd) occupiedNights += daysBetweenIso(inStart, inEnd);
    // Full current calendar month (actual + booked nights within the month)
    const inStartM = r.checkIn  > monthStart       ? r.checkIn  : monthStart;
    const inEndM   = r.checkOut < fullMonthEndExcl ? r.checkOut : fullMonthEndExcl;
    if (inStartM < inEndM) monthOccNights += daysBetweenIso(inStartM, inEndM);
    // Today (half-open interval: checkIn ≤ today < checkOut)
    if (r.checkIn <= today && today < r.checkOut) occupiedTodaySet.add(r.propertyId);
  }

  const totalProperties      = guesty.properties.length;
  const totalNightsAvailable = totalProperties * 30;
  const occupancyPct = totalNightsAvailable > 0
    ? Math.round((occupiedNights / totalNightsAvailable) * 1000) / 10
    : 0;
  const occupiedToday    = occupiedTodaySet.size;
  const todayPct = totalProperties > 0
    ? Math.round((occupiedToday / totalProperties) * 100)
    : 0;
  const monthNightsAvailable = totalProperties * daysInMonth;
  const monthOccPct = monthNightsAvailable > 0
    ? Math.round((monthOccNights / monthNightsAvailable) * 1000) / 10
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

  // ---- 4. New bookings this month, next-month on-the-books, advance revenue ----
  const nm           = nyNextMonthRange();
  const nmStart      = nm.start;
  const nmEndExcl    = addDaysIso(nm.end, 1);
  const nmDays       = daysBetweenIso(nm.start, nm.end) + 1;

  let newBookingsCount = 0, newBookingsAmount = 0;
  let nmRevenue = 0, nmNights = 0;
  let advCount = 0, advRevenue = 0, advThrough = "";

  for (const r of guesty.reservations) {
    if (r.status !== "confirmed") continue;

    // New sales = reservations *created* this month (any stay date), by NY
    // calendar day. Confirmed only — Guesty "inquiry" rows are guest
    // questions, not bookings, and would massively overcount if included.
    const booked = r.createdAt ? nyToday(new Date(r.createdAt)) : null;
    if (booked && booked >= monthStart && booked <= today) {
      newBookingsCount  += 1;
      newBookingsAmount += r.grossRevenue;
    }

    // Next month on the books — apportion gross by nights falling in next month.
    const inStart = r.checkIn  > nmStart   ? r.checkIn  : nmStart;
    const inEnd   = r.checkOut < nmEndExcl ? r.checkOut : nmEndExcl;
    if (inStart < inEnd) {
      const nights = daysBetweenIso(inStart, inEnd);
      nmNights  += nights;
      nmRevenue += r.grossRevenue * (nights / Math.max(1, r.nights));
    }

    // Advance revenue — full value of every future-dated booking on the books.
    if (r.checkIn > today) {
      advCount   += 1;
      advRevenue += r.grossRevenue;
      if (r.checkOut > advThrough) advThrough = r.checkOut;
    }
  }

  const nmOccPct = totalProperties > 0
    ? Math.round((nmNights / (totalProperties * nmDays)) * 1000) / 10
    : 0;

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
    todayOccupancy: {
      date:        today,
      totalProperties,
      occupied:    occupiedToday,
      vacant:      Math.max(0, totalProperties - occupiedToday),
      occupancyPct: todayPct,
    },
    monthOccupancy: {
      monthLabel:           nyMonthLabel(),
      occupiedNights:       monthOccNights,
      totalNightsAvailable: monthNightsAvailable,
      occupancyPct:         monthOccPct,
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
    newBookings: {
      monthLabel: nyMonthLabel(),
      count:      newBookingsCount,
      amount:     Math.round(newBookingsAmount),
    },
    nextMonth: {
      monthLabel:    nm.label,
      bookedRevenue: Math.round(nmRevenue),
      bookedNights:  nmNights,
      occupancyPct:  nmOccPct,
    },
    advance: {
      count:       advCount,
      revenue:     Math.round(advRevenue),
      throughDate: advThrough ? advThrough.slice(0, 10) : "",
    },
  };
}
