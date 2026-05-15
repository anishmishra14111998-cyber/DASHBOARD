"use client";
import { useEffect, useState } from "react";
import type { FounderSnapshot } from "@/lib/founder";

const REFRESH_MS = 15 * 60 * 1000;

const fmtMoney = (n: number) =>
  `$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const fmtMoneyK = (n: number) =>
  n >= 10_000 ? `$${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}K` : fmtMoney(n);

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
      <main className="mx-auto max-w-7xl p-6">
        <div className="rounded-xl border border-bad/40 bg-bad/5 p-5 text-bad">
          Failed to load founder update: {error}
        </div>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="mx-auto grid h-[calc(100vh-56px)] max-w-7xl grid-rows-[auto_1fr] gap-4 px-4 py-4">
        <div className="skeleton h-10 w-72" />
        <div className="grid grid-cols-2 grid-rows-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" />)}
        </div>
      </main>
    );
  }

  const { pickup, occupancy, todayOccupancy, reviews } = data;
  const expectedPct = pickup.daysInMonth > 0
    ? (pickup.daysElapsed / pickup.daysInMonth) * 100
    : 0;

  return (
    // Fixed-height main: header row + 2x2 grid in remaining space. No scroll on lg+.
    <main className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4 lg:h-[calc(100vh-56px)] lg:overflow-hidden animate-fade-in">
      {/* Compact hero */}
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">
            Founder Update
          </p>
          <h1 className="font-serif text-xl sm:text-2xl tracking-tight text-text">
            The Daily 4-Number Dashboard
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-faint">
            {new Date(data.generatedAt).toLocaleTimeString()}
          </span>
          <button
            onClick={load}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-panel px-2.5 py-1.5 text-xs text-text transition-colors hover:border-borderStrong disabled:opacity-50"
          >
            <svg className={refreshing ? "animate-spin text-accent" : "text-muted"} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><polyline points="21 3 21 8 16 8" />
            </svg>
            {refreshing ? "…" : "Refresh"}
          </button>
        </div>
      </header>

      {/* 2x2 grid filling the remaining viewport */}
      <div className="grid flex-1 grid-cols-1 grid-rows-[auto] gap-3 sm:gap-4 lg:grid-cols-2 lg:grid-rows-2 lg:min-h-0">
        {/* ── 1. Revenue Pickup ── */}
        <Card
          number={1}
          label="Revenue Pickup"
          title="Pacing vs Target"
          description="How much new revenue was booked yesterday? Are we ahead or behind the monthly goal?"
          badge={<PaceBadge status={pickup.paceStatus} variance={pickup.variance} />}
        >
          <div className="flex items-baseline gap-3">
            <span className="font-serif text-5xl sm:text-6xl tabular-nums font-semibold text-text">
              {fmtMoneyK(pickup.actualMtdRevenue)}
            </span>
            <span className="text-lg sm:text-xl text-faint tabular-nums">/ {fmtMoneyK(pickup.target)}</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-panel3">
            <div
              className={
                "h-full rounded-full transition-all duration-700 " + (
                  pickup.paceStatus === "ahead"  ? "bg-good" :
                  pickup.paceStatus === "behind" ? "bg-bad"  : "bg-accent"
                )
              }
              style={{ width: `${Math.min(100, pickup.pctOfTarget)}%` }}
            />
            <div
              className="relative -mt-2 h-2 w-px bg-text/80"
              style={{ marginLeft: `${Math.min(100, expectedPct)}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] text-muted">
            Yesterday: <span className="tabular-nums text-text">{fmtMoney(pickup.yesterdayRevenue)}</span>
            {" "}({pickup.yesterdayBookings} booking{pickup.yesterdayBookings === 1 ? "" : "s"})
            {" · "}
            Day {pickup.daysElapsed}/{pickup.daysInMonth} · Pace {fmtMoneyK(pickup.expectedPace)}
          </p>
        </Card>

        {/* ── 2. Portfolio Occupancy · 30-Day Forward ── */}
        <Card
          number={2}
          label="Portfolio Occupancy"
          title="30-Day Forward"
          description="What percentage of our calendar is booked for the next 30 days? Identifies upcoming gaps."
        >
          <div className="flex items-baseline gap-3">
            <span className={
              "font-serif text-5xl sm:text-6xl tabular-nums font-semibold " + occColor(occupancy.occupancyPct)
            }>
              {occupancy.occupancyPct.toFixed(1)}%
            </span>
            <span className="text-sm text-muted tabular-nums">
              {occupancy.occupiedNights.toLocaleString()} / {occupancy.totalNightsAvailable.toLocaleString()} nights
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-panel3">
            <div
              className={"h-full rounded-full transition-all duration-700 " + occBar(occupancy.occupancyPct)}
              style={{ width: `${occupancy.occupancyPct}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] text-muted">
            Next 30 days · {occupancy.totalProperties} listings · {" "}
            <span className="tabular-nums text-text">
              {(occupancy.totalNightsAvailable - occupancy.occupiedNights).toLocaleString()}
            </span> open nights to fill
          </p>
        </Card>

        {/* ── 3. Today's Occupancy ── */}
        <Card
          number={3}
          label="Today's Occupancy"
          title="Right Now"
          description="How many of our listings are occupied tonight versus sitting empty."
        >
          <div className="flex items-baseline gap-3">
            <span className={
              "font-serif text-5xl sm:text-6xl tabular-nums font-semibold " + occColor(todayOccupancy.occupancyPct)
            }>
              {todayOccupancy.occupancyPct}%
            </span>
            <span className="text-sm text-muted tabular-nums">
              {todayOccupancy.occupied} / {todayOccupancy.totalProperties} occupied
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-panel3">
            <div
              className={"h-full rounded-full transition-all duration-700 " + occBar(todayOccupancy.occupancyPct)}
              style={{ width: `${todayOccupancy.occupancyPct}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] text-muted">
            <span className="tabular-nums text-text">{todayOccupancy.vacant}</span> vacant ·{" "}
            <span className="tabular-nums text-text">{todayOccupancy.occupied}</span> with guests checked in
          </p>
        </Card>

        {/* ── 4. Average Review Score · Trailing 30 Days ── */}
        <Card
          number={4}
          label="Average Review Score"
          title="Trailing 30 Days"
          description="The leading indicator of future revenue. A drop here means a drop in bookings next month."
        >
          <div className="flex items-baseline gap-3">
            <span className={
              "font-serif text-5xl sm:text-6xl tabular-nums font-semibold " + reviewColor(reviews.avg)
            }>
              {reviews.count > 0 ? reviews.avg.toFixed(2) : "—"}
            </span>
            <span className="text-lg text-muted">/ 5</span>
            <span className="ml-auto tracking-wider text-lg sm:text-xl">
              <span className="text-warn">{"★".repeat(Math.round(reviews.avg))}</span>
              <span className="text-borderStrong">{"★".repeat(5 - Math.round(reviews.avg))}</span>
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2 text-[11px]">
            <span className="text-muted">{reviews.count} reviews · last 30 days</span>
            <span className="text-faint">·</span>
            <span className={
              reviews.delta > 0.01  ? "text-good font-semibold" :
              reviews.delta < -0.01 ? "text-bad  font-semibold" : "text-muted"
            }>
              {reviews.delta > 0 ? "▲" : reviews.delta < 0 ? "▼" : "●"}{" "}
              {reviews.delta > 0 ? "+" : ""}{reviews.delta.toFixed(2)} vs prev
            </span>
            <span className="text-faint">·</span>
            <span className="text-muted tabular-nums">
              prev: {reviews.prevCount > 0 ? reviews.prevAvg.toFixed(2) : "—"}
            </span>
          </div>
        </Card>
      </div>
    </main>
  );
}

// ─── Card ────────────────────────────────────────────────────────────────────

function Card({
  number, label, title, description, badge, children,
}: {
  number: number;
  label: string;
  title: string;
  description: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-h-0 flex-col rounded-2xl border border-border bg-panel p-4 sm:p-5 shadow-soft">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">
          {number} · {label}
        </p>
        {badge}
      </div>
      <h2 className="mt-1 font-serif text-xl sm:text-2xl tracking-tight text-accent">
        {title}
      </h2>
      <div className="mt-3 flex-1 min-h-0 flex flex-col justify-center">
        {children}
      </div>
      <p className="mt-3 text-[10px] leading-snug text-faint line-clamp-2">
        {description}
      </p>
    </section>
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
    status === "ahead"  ? `▲ Ahead $${Math.abs(variance).toLocaleString()}` :
    status === "behind" ? `▼ Behind $${Math.abs(variance).toLocaleString()}` :
                          "● On track";
  return (
    <span className={"rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap " + cls}>
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
