"use client";
import { useEffect, useMemo, useState } from "react";
import { MetricCard } from "@/components/MetricCard";
import { DailyChart } from "@/components/DailyChart";
import { ChannelCommissionTable } from "@/components/ChannelCommissionTable";
import { NextMonthForecastPanel } from "@/components/NextMonthForecast";
import { PropertyBreakdownTable } from "@/components/PropertyBreakdownTable";
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
      <main className="mx-auto max-w-7xl p-6">
        <div className="rounded-xl border border-bad bg-panel p-4 text-bad">
          Failed to load metrics: {error}
        </div>
      </main>
    );
  }
  if (!data || !filtered) {
    return <main className="mx-auto max-w-7xl p-6 text-muted">Loading dashboard…</main>;
  }

  const propertyCount = filtered.properties.length;
  const today = buildTodaySnapshot(filtered.reservations, propertyCount);
  const period = buildPeriodBases(filtered.reservations, propertyCount, range);
  const daily = buildDailySeries(filtered.reservations, propertyCount, range);
  const channels = buildChannelCommission(filtered.reservations, range);
  const nextMonth = buildNextMonthForecast(filtered.reservations, propertyCount);
  const propertyRows = buildPropertyBreakdown(filtered.reservations, filtered.properties, range);

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Revenue Dashboard</p>
          <p className="mt-1 text-sm text-muted">
            Live Guesty data · America/New_York · auto-refresh 15min ·{" "}
            <span className="text-text">{nyTimeLabel(new Date(data.generatedAt))}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={refreshing}
            className="rounded-lg border border-border bg-panel px-3 py-2 text-sm text-text hover:bg-panel2 disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "Refresh now"}
          </button>
          <PropertyFilter
            properties={data.properties}
            value={propertyId}
            onChange={setPropertyId}
          />
        </div>
      </header>

      <SourceStatusBar guesty={data.sources.guesty} />

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
          Today · {nyWeekdayDateLabel()} (NY)
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <MetricCard label="Properties Available" value={today.totalProperties.toString()} sub="active listings" />
          <MetricCard label="Sold (occupied tonight)" value={today.occupied.toString()} sub={`${today.occupancyPct}% occupancy`} tone="good" />
          <MetricCard label="Vacant tonight" value={today.vacant.toString()} sub={today.vacant === 0 ? "fully booked" : "available"} tone={today.vacant === 0 ? "good" : "default"} />
          <MetricCard label="Today's Revenue" value={fmtMoney(today.todayRevenue)} sub={`${fmtMoney(today.todayCommission)} commission · ${today.newBookingsToday} new bookings`} />
        </div>
      </section>

      <TimelineFilter value={range} onChange={setRange} />

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
          {period.rangeLabel} · {period.rangeStart} → {period.rangeEnd} ({period.daysInRange} days)
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <MetricCard label="Gross Revenue" value={fmtMoney(period.stayedNights.grossRevenue)} sub="stayed-nights basis" />
          <MetricCard label="Commission" value={fmtMoney(period.stayedNights.commission)} sub={`${period.stayedNights.commissionPct}% of gross`} tone="bad" />
          <MetricCard label="Net Payout" value={fmtMoney(period.stayedNights.netPayout)} sub={`${period.stayedNights.bookings} bookings touched`} tone="good" />
          <MetricCard label="Occupancy" value={`${period.occupancyPct}%`} sub={`${period.stayedNights.nights} / ${period.totalNightsAvailable} nights`} />
        </div>
      </section>

      <NextMonthForecastPanel data={nextMonth} />

      <MtdBasesTable data={period} />

      <DailyChart data={daily} />

      <ChannelCommissionTable data={channels} />

      <PropertyBreakdownTable data={propertyRows} rangeLabel={`${period.rangeLabel} · ${period.rangeStart} → ${period.rangeEnd}`} />
    </main>
  );
}
