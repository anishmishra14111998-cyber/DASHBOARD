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
      <main className="mx-auto grid h-[calc(100vh-56px)] max-w-7xl grid-rows-[auto_1fr] gap-6 px-6 py-6">
        <div className="skeleton h-12 w-96" />
        <div className="grid grid-cols-2 grid-rows-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" />)}
        </div>
      </main>
    );
  }

  const { pickup, occupancy, todayOccupancy, reviews } = data;

  return (
    // Single-screen layout: hero on top, 2x2 grid fills the rest. No scroll on lg+.
    <main className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-6 sm:gap-6 sm:px-8 sm:py-8 lg:h-[calc(100vh-56px)] lg:overflow-hidden animate-fade-in">
      {/* Hero — matches the slide */}
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl tracking-tight text-text">
          The Daily 4-Number Dashboard
        </h1>
        <div className="flex items-center gap-3 text-[11px] text-faint">
          <span>{new Date(data.generatedAt).toLocaleTimeString()}</span>
          <button
            onClick={load}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-panel px-2 py-1 text-xs text-muted transition-colors hover:border-borderStrong hover:text-text disabled:opacity-50"
          >
            <svg className={refreshing ? "animate-spin text-accent" : ""} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><polyline points="21 3 21 8 16 8" />
            </svg>
            {refreshing ? "…" : "Refresh"}
          </button>
        </div>
      </header>

      {/* 2x2 grid filling the remaining viewport */}
      <div className="grid flex-1 grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-2 lg:grid-rows-2 lg:min-h-0">
        <Card
          number={1}
          label="Revenue Pickup"
          title="Pacing vs Target"
          description="How much new revenue was booked yesterday? Are we ahead or behind the monthly goal?"
          metric={`${fmtMoneyK(pickup.actualMtdRevenue)} / ${fmtMoneyK(pickup.target)}`}
          metricTone={
            pickup.paceStatus === "ahead"  ? "good" :
            pickup.paceStatus === "behind" ? "bad"  : "default"
          }
          subline={
            pickup.paceStatus === "ahead"  ? `Ahead by ${fmtMoney(pickup.variance)} · ${pickup.pctOfTarget.toFixed(0)}% of goal` :
            pickup.paceStatus === "behind" ? `Behind by ${fmtMoney(pickup.variance)} · ${pickup.pctOfTarget.toFixed(0)}% of goal` :
                                              `On track · ${pickup.pctOfTarget.toFixed(0)}% of goal`
          }
        />

        <Card
          number={2}
          label="Portfolio Occupancy"
          title="30-Day Forward"
          description="What percentage of our calendar is booked for the next 30 days? Identifies upcoming gaps."
          metric={`${occupancy.occupancyPct.toFixed(1)}%`}
          metricTone={occTone(occupancy.occupancyPct)}
          subline={`${occupancy.occupiedNights.toLocaleString()} of ${occupancy.totalNightsAvailable.toLocaleString()} nights booked`}
        />

        <Card
          number={3}
          label="Today's Occupancy"
          title="Right Now"
          description="How many of our listings are occupied tonight versus sitting empty."
          metric={`${todayOccupancy.occupancyPct}%`}
          metricTone={occTone(todayOccupancy.occupancyPct)}
          subline={`${todayOccupancy.occupied} of ${todayOccupancy.totalProperties} listings occupied · ${todayOccupancy.vacant} vacant`}
        />

        <Card
          number={4}
          label="Average Review Score"
          title="Trailing 30 Days"
          description="The leading indicator of future revenue. A drop here means a drop in bookings next month."
          metric={reviews.count > 0 ? reviews.avg.toFixed(2) : "—"}
          metricSuffix={reviews.count > 0 ? " / 5" : ""}
          metricTone={reviewTone(reviews.avg)}
          subline={
            reviews.count === 0
              ? "No reviews in window"
              : `${reviews.count} reviews · ${reviews.delta >= 0 ? "+" : ""}${reviews.delta.toFixed(2)} vs prior 30 days`
          }
        />
      </div>
    </main>
  );
}

// ─── Card — slide-style layout ───────────────────────────────────────────────

type Tone = "default" | "good" | "warn" | "bad";

function Card({
  number, label, title, description, metric, metricSuffix, metricTone = "default", subline,
}: {
  number: number;
  label: string;
  title: string;
  description: string;
  metric: string;
  metricSuffix?: string;
  metricTone?: Tone;
  subline: string;
}) {
  const metricCls =
    metricTone === "good" ? "text-good" :
    metricTone === "bad"  ? "text-bad"  :
    metricTone === "warn" ? "text-warn" : "text-text";

  return (
    <section className="flex min-h-0 flex-col rounded-2xl border border-border bg-panel p-6 sm:p-8 shadow-soft">
      {/* Small label like "1. REVENUE PICKUP" */}
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
        {number}. {label}
      </p>

      {/* The big blue serif title — slide's focal element */}
      <h2 className="mt-3 font-serif text-3xl sm:text-4xl lg:text-5xl tracking-tight text-accent leading-tight">
        {title}
      </h2>

      {/* Live metric beneath the title */}
      <div className="mt-5 flex items-baseline gap-2">
        <span className={`font-serif text-3xl sm:text-4xl tabular-nums font-semibold ${metricCls}`}>
          {metric}
        </span>
        {metricSuffix && (
          <span className="text-lg text-muted">{metricSuffix}</span>
        )}
      </div>
      <p className="mt-1 text-xs text-muted">{subline}</p>

      {/* Description anchored at bottom — slide's body text */}
      <p className="mt-auto pt-5 text-sm leading-relaxed text-muted">
        {description}
      </p>
    </section>
  );
}

function occTone(pct: number): Tone {
  if (pct >= 70) return "good";
  if (pct >= 50) return "warn";
  return "bad";
}
function reviewTone(avg: number): Tone {
  if (avg <= 0)  return "default";
  if (avg >= 4.7) return "good";
  if (avg >= 4.3) return "warn";
  return "bad";
}
