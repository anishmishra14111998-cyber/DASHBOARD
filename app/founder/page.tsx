"use client";
import { useEffect, useState } from "react";
import type { FounderSnapshot } from "@/lib/founder";

const REFRESH_MS = 15 * 60 * 1000;

const fmtMoney = (n: number) =>
  `$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const fmtMoneyK = (n: number) =>
  n >= 10_000 ? `$${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}K` : fmtMoney(n);
const fmtDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, {
    month: "short", day: "numeric", timeZone: "UTC",
  });

export default function FounderUpdatePage() {
  const [data, setData] = useState<FounderSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/founder", { cache: "no-store" });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      setData(await res.json());
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  if (error) {
    return (
      <main className="mx-auto max-w-7xl p-8">
        <div className="rounded-xl border border-bad/40 bg-bad/5 p-5 text-bad">
          Failed to load founder update: {error}
        </div>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="mx-auto max-w-7xl space-y-10 px-4 sm:px-6 py-10">
        <div className="space-y-3">
          <div className="skeleton h-3 w-24" />
          <div className="skeleton h-10 w-96" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-72" />)}
        </div>
      </main>
    );
  }

  const { pickup, occupancy, reviews } = data;

  return (
    <main className="mx-auto max-w-7xl space-y-10 px-4 sm:px-6 py-10 animate-fade-in">
      {/* Hero */}
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
            Founder Update
          </p>
          <h1 className="mt-2 font-serif text-display-lg tracking-tight text-text">
            The Daily 3-Number Dashboard
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            Pacing · Forward occupancy · Review score · auto-refresh 15 min ·{" "}
            <span className="text-text">{new Date(data.generatedAt).toLocaleTimeString()}</span>
          </p>
        </div>
        <button
          onClick={load}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-panel px-3 py-2 text-sm text-text shadow-ring transition-colors hover:border-borderStrong disabled:opacity-50"
        >
          <svg className={refreshing ? "animate-spin text-accent" : "text-muted"} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><polyline points="21 3 21 8 16 8" />
          </svg>
          {refreshing ? "Refreshing" : "Refresh"}
        </button>
      </section>

      {/* Card 1: Revenue Pickup · Pacing vs Target */}
      <section className="rounded-2xl border border-border bg-panel p-6 sm:p-8 shadow-soft">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">
              1 · Revenue Pickup
            </p>
            <h2 className="mt-2 font-serif text-3xl sm:text-4xl tracking-tight text-accent">
              Pacing vs Target
            </h2>
          </div>
          <PaceBadge status={pickup.paceStatus} variance={pickup.variance} />
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {/* Yesterday */}
          <div className="rounded-xl border border-border/60 bg-panel2/40 p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">
              Booked yesterday · {fmtDate(pickup.yesterdayDate)}
            </p>
            <p className="mt-2 text-display tabular-nums font-semibold text-text">
              {fmtMoney(pickup.yesterdayRevenue)}
            </p>
            <p className="mt-1 text-xs text-muted">
              {pickup.yesterdayBookings} new booking{pickup.yesterdayBookings === 1 ? "" : "s"}
            </p>
          </div>

          {/* MTD vs target */}
          <div className="rounded-xl border border-border/60 bg-panel2/40 p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">
              {pickup.monthLabel} · Day {pickup.daysElapsed} of {pickup.daysInMonth}
            </p>
            <p className="mt-2 text-display tabular-nums font-semibold text-text">
              {fmtMoneyK(pickup.actualMtdRevenue)}
              <span className="text-faint"> / </span>
              <span className="text-muted">{fmtMoneyK(pickup.target)}</span>
            </p>
            <p className="mt-1 text-xs text-muted">
              Expected pace: <span className="text-text tabular-nums">{fmtMoneyK(pickup.expectedPace)}</span>
              {" · "}
              <span className={
                pickup.paceStatus === "ahead"  ? "text-good" :
                pickup.paceStatus === "behind" ? "text-bad"  : "text-text"
              }>
                {pickup.paceStatus === "ahead"  && `ahead by ${fmtMoney(pickup.variance)}`}
                {pickup.paceStatus === "behind" && `behind by ${fmtMoney(pickup.variance)}`}
                {pickup.paceStatus === "on-track" && "on track"}
              </span>
            </p>
          </div>
        </div>

        {/* Pacing bar */}
        <div className="mt-6">
          <div className="mb-1.5 flex justify-between text-[10px] uppercase tracking-wider">
            <span className="text-faint">Progress toward {fmtMoneyK(pickup.target)} target</span>
            <span className={
              "tabular-nums font-bold " + (
                pickup.paceStatus === "ahead"  ? "text-good" :
                pickup.paceStatus === "behind" ? "text-bad"  : "text-text"
              )
            }>
              {pickup.pctOfTarget.toFixed(1)}%
            </span>
          </div>
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-panel3">
            {/* Actual */}
            <div
              className={
                "absolute inset-y-0 left-0 rounded-full transition-all duration-700 " + (
                  pickup.paceStatus === "ahead"  ? "bg-good" :
                  pickup.paceStatus === "behind" ? "bg-bad"  : "bg-accent"
                )
              }
              style={{ width: `${Math.min(100, pickup.pctOfTarget)}%` }}
            />
            {/* Expected pace marker */}
            <div
              className="absolute inset-y-0 w-px bg-text/80"
              style={{ left: `${Math.min(100, (pickup.daysElapsed / pickup.daysInMonth) * 100)}%` }}
              title="Expected pace"
            />
          </div>
          <p className="mt-1.5 text-[10px] text-faint">
            Vertical line = expected pace for day {pickup.daysElapsed} of {pickup.daysInMonth}
          </p>
        </div>

        <p className="mt-5 text-xs text-muted">
          How much new revenue was booked yesterday? Are we ahead or behind the monthly goal?
        </p>
      </section>

      {/* Card 2: Portfolio Occupancy · 30-Day Forward */}
      <section className="rounded-2xl border border-border bg-panel p-6 sm:p-8 shadow-soft">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">
              2 · Portfolio Occupancy
            </p>
            <h2 className="mt-2 font-serif text-3xl sm:text-4xl tracking-tight text-accent">
              30-Day Forward
            </h2>
          </div>
          <span className="rounded-full border border-border bg-panel2 px-3 py-1 text-[11px] text-muted whitespace-nowrap">
            {fmtDate(occupancy.start)} → {fmtDate(occupancy.end)}
          </span>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <div className="rounded-xl border border-border/60 bg-panel2/40 p-5 md:col-span-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">
              Forward occupancy
            </p>
            <p className={
              "mt-2 text-display-lg tabular-nums font-semibold " + occColor(occupancy.occupancyPct)
            }>
              {occupancy.occupancyPct.toFixed(1)}%
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-panel2/40 p-5 md:col-span-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">
              Nights booked · {occupancy.totalProperties} listings
            </p>
            <p className="mt-2 text-display tabular-nums font-semibold text-text">
              {occupancy.occupiedNights.toLocaleString()}
              <span className="text-faint"> / </span>
              <span className="text-muted">{occupancy.totalNightsAvailable.toLocaleString()}</span>
            </p>
            <p className="mt-1 text-xs text-muted">
              {(occupancy.totalNightsAvailable - occupancy.occupiedNights).toLocaleString()} open nights to fill
            </p>
            <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-panel3">
              <div
                className={"h-full rounded-full transition-all duration-700 " + occBar(occupancy.occupancyPct)}
                style={{ width: `${occupancy.occupancyPct}%` }}
              />
            </div>
          </div>
        </div>

        <p className="mt-5 text-xs text-muted">
          What percentage of our calendar is booked for the next 30 days? Identifies upcoming gaps.
        </p>
      </section>

      {/* Card 3: Average Review Score · Trailing 30 Days */}
      <section className="rounded-2xl border border-border bg-panel p-6 sm:p-8 shadow-soft">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">
              3 · Average Review Score
            </p>
            <h2 className="mt-2 font-serif text-3xl sm:text-4xl tracking-tight text-accent">
              Trailing 30 Days
            </h2>
          </div>
          <span className="rounded-full border border-border bg-panel2 px-3 py-1 text-[11px] text-muted whitespace-nowrap">
            {fmtDate(reviews.windowStart)} → {fmtDate(reviews.windowEnd)}
          </span>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <div className="rounded-xl border border-border/60 bg-panel2/40 p-5 md:col-span-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">
              Average rating
            </p>
            <p className={
              "mt-2 text-display-lg tabular-nums font-semibold " + reviewColor(reviews.avg)
            }>
              {reviews.count > 0 ? reviews.avg.toFixed(2) : "—"}
              <span className="ml-1 text-muted text-2xl">/ 5</span>
            </p>
            <div className="mt-2 tracking-wider text-xl">
              <span className="text-warn">{"★".repeat(Math.round(reviews.avg))}</span>
              <span className="text-borderStrong">{"★".repeat(5 - Math.round(reviews.avg))}</span>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-panel2/40 p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">
              Reviews in window
            </p>
            <p className="mt-2 text-display tabular-nums font-semibold text-text">
              {reviews.count.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-muted">last 30 days</p>
          </div>

          <div className="rounded-xl border border-border/60 bg-panel2/40 p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">
              vs prior 30 days
            </p>
            <p className={
              "mt-2 text-display tabular-nums font-semibold " + (
                reviews.delta > 0.01  ? "text-good" :
                reviews.delta < -0.01 ? "text-bad"  : "text-text"
              )
            }>
              {reviews.delta > 0 ? "+" : ""}{reviews.delta.toFixed(2)}
            </p>
            <p className="mt-1 text-xs text-muted">
              prev avg: <span className="text-text tabular-nums">
                {reviews.prevCount > 0 ? reviews.prevAvg.toFixed(2) : "—"}
              </span>
              {" "}({reviews.prevCount} reviews)
            </p>
          </div>
        </div>

        <p className="mt-5 text-xs text-muted">
          The leading indicator of future revenue. A drop here means a drop in bookings next month.
        </p>
      </section>
    </main>
  );
}

function PaceBadge({
  status, variance,
}: { status: "ahead" | "behind" | "on-track"; variance: number }) {
  const cls =
    status === "ahead"  ? "border-good/40 bg-good/10 text-good" :
    status === "behind" ? "border-bad/40  bg-bad/10  text-bad"  :
                          "border-border  bg-panel2  text-text";
  const label =
    status === "ahead"  ? `▲ Ahead by $${Math.abs(variance).toLocaleString()}` :
    status === "behind" ? `▼ Behind by $${Math.abs(variance).toLocaleString()}` :
                          "● On track";
  return (
    <span className={"rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap " + cls}>
      {label}
    </span>
  );
}

function occColor(pct: number): string {
  if (pct >= 70) return "text-good";
  if (pct >= 50) return "text-warn";
  return "text-bad";
}
function occBar(pct: number): string {
  if (pct >= 70) return "bg-good";
  if (pct >= 50) return "bg-warn";
  return "bg-bad";
}
function reviewColor(avg: number): string {
  if (avg >= 4.7) return "text-good";
  if (avg >= 4.3) return "text-warn";
  if (avg <= 0)   return "text-text";
  return "text-bad";
}
