"use client";
import { useEffect, useMemo, useState } from "react";
import { MetricCard } from "@/components/MetricCard";
import { DailyChart } from "@/components/DailyChart";
import { ChannelCommissionTable } from "@/components/ChannelCommissionTable";
import { NextMonthForecastPanel } from "@/components/NextMonthForecast";
import { PropertyBreakdownTable } from "@/components/PropertyBreakdownTable";
import { TodaysBookings } from "@/components/TodaysBookings";
import { PropertyFilter } from "@/components/PropertyFilter";
import { SourceStatusBar } from "@/components/SourceStatusBar";
import { TimelineFilter } from "@/components/TimelineFilter";
import { MtdBasesTable } from "@/components/MtdBasesTable";
import {
  buildChannelCommission,
  buildDailySeries,
  buildNextMonthForecast,
  buildPeriodBases,
  buildPropertyBreakdown,
  buildTodaySnapshot,
} from "@/lib/aggregate";
import {
  nyTimeLabel,
  nyWeekdayDateLabel,
  rangeForPreset,
  type DateRange,
} from "@/lib/datetime";
import type { MetricsResponse } from "@/lib/types";

const REFRESH_MS = 15 * 60 * 1000;
const fmtMoney = (n: number) =>
  `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function DashboardPage() {
  const [data, setData] = useState<MetricsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [propertyId, setPropertyId] = useState<string>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState<DateRange>(() => rangeForPreset("this-month"));

  async function load() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/metrics", { cache: "no-store" });
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

  const filtered = useMemo(() => {
    if (!data) return null;
    const reservations =
      propertyId === "all"
        ? data.reservations
        : data.reservations.filter((r) => r.propertyId === propertyId);
    const properties =
      propertyId === "all"
        ? data.properties
        : data.properties.filter((p) => p.id === propertyId);
    return { reservations, properties };
  }, [data, propertyId]);

  if (error) {
    return (
      <main className="mx-auto max-w-7xl p-8">
        <div className="rounded-xl border border-bad/40 bg-bad/5 p-5 text-bad">
          Failed to load metrics: {error}
        </div>
      </main>
    );
  }
  if (!data || !filtered) {
    return <DashboardSkeleton />;
  }

  const propertyCount = filtered.properties.length;
  const today = buildTodaySnapshot(filtered.reservations, propertyCount);
  const period = buildPeriodBases(filtered.reservations, propertyCount, range);
  const daily = buildDailySeries(filtered.reservations, propertyCount, range);
  const channels = buildChannelCommission(filtered.reservations, range);
  const nextMonth = buildNextMonthForecast(filtered.reservations, propertyCount);
  const propertyRows = buildPropertyBreakdown(filtered.reservations, filtered.properties, range);

  return (
    <main className="mx-auto max-w-7xl space-y-10 px-6 py-10 animate-fade-in">
      {/* Page hero */}
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
            Revenue Overview
          </p>
          <h1 className="mt-2 text-display-lg tracking-tight text-text">
            {nyWeekdayDateLabel()}
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            Live Guesty data · America/New_York · auto-refresh 15 min · last sync{" "}
            <span className="text-text">{nyTimeLabel(new Date(data.generatedAt))}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SourceStatusBar guesty={data.sources.guesty} />
          <button
            onClick={load}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-panel px-3 py-2 text-sm text-text shadow-ring transition-colors hover:border-borderStrong disabled:opacity-50"
          >
            <svg className={refreshing ? "animate-spin text-accent" : "text-muted"} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
              <polyline points="21 3 21 8 16 8" />
            </svg>
            {refreshing ? "Refreshing" : "Refresh"}
          </button>
          <PropertyFilter
            properties={data.properties}
            value={propertyId}
            onChange={setPropertyId}
          />
        </div>
      </section>

      {/* Today */}
      <section>
        <SectionTitle eyebrow="Today" title={nyWeekdayDateLabel()} />
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          <MetricCard label="Properties Available" value={today.totalProperties.toString()} sub="active listings" />
          <MetricCard label="Sold Tonight" value={today.occupied.toString()} sub={`${today.occupancyPct}% occupancy`} tone="good" />
          <MetricCard label="Vacant Tonight" value={today.vacant.toString()} sub={today.vacant === 0 ? "fully booked" : "available"} tone={today.vacant === 0 ? "good" : "default"} />
          <MetricCard label="Today's Revenue" value={fmtMoney(today.todayRevenue)} sub={`${fmtMoney(today.todayCommission)} commission · ${today.newBookingsToday} new bookings`} tone="accent" />
        </div>
      </section>

      {/* Filter */}
      <TimelineFilter value={range} onChange={setRange} />

      {/* Period summary */}
      <section>
        <SectionTitle
          eyebrow={period.rangeLabel}
          title={`${period.rangeStart} → ${period.rangeEnd}`}
          right={`${period.daysInRange} days`}
        />
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          <MetricCard label="Gross Revenue" value={fmtMoney(period.stayedNights.grossRevenue)} sub="stayed-nights basis" />
          <MetricCard label="Commission" value={fmtMoney(period.stayedNights.commission)} sub={`${period.stayedNights.commissionPct}% of gross`} tone="bad" />
          <MetricCard label="Net Payout" value={fmtMoney(period.stayedNights.netPayout)} sub={`${period.stayedNights.bookings} bookings touched`} tone="good" />
          <MetricCard label="Occupancy" value={`${period.occupancyPct}%`} sub={`${period.stayedNights.nights} / ${period.totalNightsAvailable} nights`} tone="accent" />
        </div>
      </section>

      {/* New bookings received today — compact bar, click pending to expand */}
      <TodaysBookings bookings={today.newBookingsData} paid={today.paidNewBookingsToday} />

      <NextMonthForecastPanel data={nextMonth} />

      <MtdBasesTable data={period} />

      <DailyChart data={daily} />

      <ChannelCommissionTable data={channels} />

      <PropertyBreakdownTable
        data={propertyRows}
        rangeLabel={`${period.rangeLabel} · ${period.rangeStart} → ${period.rangeEnd}`}
      />
    </main>
  );
}

function SectionTitle({
  eyebrow, title, right,
}: { eyebrow: string; title: string; right?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-base font-semibold tracking-tight text-text">{title}</h2>
      </div>
      {right && <span className="text-[11px] text-muted">{right}</span>}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <main className="mx-auto max-w-7xl space-y-10 px-6 py-10">
      <div className="space-y-3">
        <div className="skeleton h-3 w-24" />
        <div className="skeleton h-10 w-72" />
        <div className="skeleton h-3 w-96" />
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-28" />
        ))}
      </div>
      <div className="skeleton h-16" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-28" />
        ))}
      </div>
      <div className="skeleton h-64" />
      <div className="skeleton h-96" />
    </main>
  );
}
