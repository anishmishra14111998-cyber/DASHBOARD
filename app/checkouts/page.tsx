"use client";
import { useEffect, useMemo, useState } from "react";
import { CheckoutTable } from "@/components/CheckoutTable";
import { TimelineFilter } from "@/components/TimelineFilter";
import { rangeForPreset, nyToday, type DateRange } from "@/lib/datetime";
import type { Checkout, CheckoutsResult } from "@/lib/checkouts";

const REFRESH_MS = 5 * 60 * 1000;

export default function CheckoutsPage() {
  const [result, setResult] = useState<CheckoutsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState<DateRange>(() => rangeForPreset("last-7"));

  async function load() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/checkouts", { cache: "no-store" });
      if (!res.ok) throw new Error(`Checkouts request failed: ${res.status}`);
      setResult(await res.json());
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

  // Apply an in-memory PATCH so optimistic edits in the table persist
  // without a full refetch.
  function applyEdit(updated: Checkout) {
    setResult(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        checkouts: prev.checkouts.map(c => c.id === updated.id ? updated : c),
      };
    });
  }

  const inRange = useMemo(() => {
    if (!result) return [] as Checkout[];
    return result.checkouts.filter(c =>
      c.checkOut >= range.start && c.checkOut <= range.end
    );
  }, [result, range]);

  const stats = useMemo(() => {
    const total = inRange.length;
    const contacted = inRange.filter(c => c.contacted).length;
    const reviewed = inRange.filter(c => c.reviewReceived).length;
    const pending = total - contacted;
    return {
      total,
      contacted,
      reviewed,
      pending,
      contactedPct: total ? (contacted / total) * 100 : 0,
      reviewedPct:  total ? (reviewed  / total) * 100 : 0,
    };
  }, [inRange]);

  const isToday = range.preset === "today";

  if (error) {
    return (
      <main className="mx-auto max-w-7xl p-8">
        <div className="rounded-xl border border-bad/40 bg-bad/5 p-5 text-bad">
          Failed to load checkouts: {error}
        </div>
      </main>
    );
  }
  if (!result) {
    return (
      <main className="mx-auto max-w-7xl space-y-10 px-4 sm:px-6 py-10">
        <div className="space-y-3">
          <div className="skeleton h-3 w-24" />
          <div className="skeleton h-10 w-72" />
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-28" />)}
        </div>
        <div className="skeleton h-96" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 py-10 animate-fade-in">
      {/* Hero */}
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
            Checkout Follow-up
          </p>
          <h1 className="mt-2 text-display-lg tracking-tight text-text">
            {stats.total.toLocaleString()} checkouts <span className="text-faint">·</span>{" "}
            <span className="tabular-nums">{stats.contacted}</span> contacted
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            Daily guest-manager outreach · auto-refresh 5 min ·{" "}
            <span className="text-text">{new Date(result.generatedAt).toLocaleTimeString()}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setRange(rangeForPreset("today"))}
            className={
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors " +
              (isToday
                ? "border-accent bg-accent text-white shadow-soft"
                : "border-border bg-panel text-text hover:border-borderStrong")
            }
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            Today
            <span className="text-[11px] opacity-70">({nyToday()})</span>
          </button>

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
        </div>
      </section>

      {/* Date filter */}
      <TimelineFilter
        value={range}
        onChange={setRange}
        presets={["today", "yesterday", "last-7", "this-week", "this-month", "last-month", "all-time"]}
      />

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi label="Total Checkouts" value={stats.total.toLocaleString()} sub={range.label.toLowerCase()} />
        <Kpi
          label="Contacted"
          value={stats.contacted.toLocaleString()}
          sub={stats.total ? `${stats.contactedPct.toFixed(0)}% of total` : "—"}
          tone="good"
        />
        <Kpi
          label="Pending Contact"
          value={stats.pending.toLocaleString()}
          sub={stats.pending > 0 ? "need follow-up" : "all caught up"}
          tone={stats.pending > 0 ? "warn" : "good"}
        />
        <Kpi
          label="Reviews Received"
          value={stats.reviewed.toLocaleString()}
          sub={stats.total ? `${stats.reviewedPct.toFixed(0)}% of total` : "—"}
          tone="accent"
        />
      </section>

      {/* Progress bar */}
      {stats.total > 0 && (
        <section className="rounded-xl border border-border bg-panel p-5 shadow-soft">
          <div className="mb-2 flex items-baseline justify-between text-[11px]">
            <span className="font-semibold uppercase tracking-wider text-muted">Contact coverage</span>
            <span className={
              "tabular-nums font-bold " + (
                stats.contactedPct >= 80 ? "text-good" :
                stats.contactedPct >= 50 ? "text-warn" : "text-bad"
              )
            }>
              {stats.contacted} / {stats.total} · {stats.contactedPct.toFixed(0)}%
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-panel3">
            <div
              className={
                "h-full rounded-full transition-all duration-700 " + (
                  stats.contactedPct >= 80 ? "bg-good" :
                  stats.contactedPct >= 50 ? "bg-warn" : "bg-bad"
                )
              }
              style={{ width: `${stats.contactedPct}%` }}
            />
          </div>
        </section>
      )}

      {/* Table */}
      <CheckoutTable data={inRange} onChange={applyEdit} />
    </main>
  );
}

function Kpi({
  label, value, sub, tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "good" | "bad" | "warn" | "accent";
}) {
  const valCls =
    tone === "good"   ? "text-good"
    : tone === "bad"  ? "text-bad"
    : tone === "warn" ? "text-warn"
    : tone === "accent" ? "text-accent"
    : "text-text";
  const accentBar =
    tone === "good"   ? "bg-good"
    : tone === "bad"  ? "bg-bad"
    : tone === "warn" ? "bg-warn"
    : tone === "accent" ? "bg-accent"
    : "bg-borderStrong";
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-panel p-5 shadow-soft transition-colors hover:border-borderStrong">
      <div className={"absolute inset-x-0 top-0 h-px opacity-50 " + accentBar} />
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</div>
      <div className={"mt-2 text-display tabular-nums font-semibold " + valCls}>{value || "—"}</div>
      {sub && <div className="mt-1.5 text-[11px] text-muted">{sub}</div>}
    </div>
  );
}
