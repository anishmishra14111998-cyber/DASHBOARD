"use client";
import { useEffect, useState } from "react";
import { CleaningTable } from "@/components/CleaningTable";
import type { CleaningData } from "@/lib/cleaning";

const REFRESH_MS = 30 * 1000;

type ViewKey = "monthly" | "weekly" | "costDetail";

const VIEWS: { id: ViewKey; label: string; sub: string }[] = [
  { id: "monthly",    label: "Monthly",     sub: "Jan – Apr 2026" },
  { id: "weekly",     label: "Weekly",      sub: "16 weeks" },
  { id: "costDetail", label: "Cost Detail", sub: "CLT vs RDU" },
];

const SHEET_LINK = "https://docs.google.com/spreadsheets/d/1y6XwRC7Ax7pax2mhpZd59cyqp8yu2j7wthI4bHN2jto/edit";

export default function CleaningPage() {
  const [data, setData] = useState<CleaningData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewKey>("monthly");
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/cleaning", { cache: "no-store" });
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
    const onFocus = () => load();
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (error) {
    return (
      <main className="mx-auto max-w-7xl p-8">
        <div className="rounded-xl border border-bad/40 bg-bad/5 p-5 text-bad">
          Failed to load cleaning data: {error}
        </div>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="mx-auto max-w-7xl space-y-10 px-6 py-10">
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

  const activeTable =
    view === "monthly"    ? data.monthly :
    view === "weekly"     ? data.weekly  :
                            data.costDetail;
  const activeView = VIEWS.find((v) => v.id === view)!;

  return (
    <main className="mx-auto max-w-7xl space-y-10 px-6 py-10 animate-fade-in">
      {/* Hero */}
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
            Cleaning Operations
          </p>
          <h1 className="mt-2 text-display-lg tracking-tight text-text">
            {data.period.monthly}
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            Live from Google Sheets · auto-refresh 30s ·{" "}
            <span className="text-text">{new Date(data.generatedAt).toLocaleTimeString()}</span>
            {data.period.portfolio && <> · <span className="text-text">{data.period.portfolio}</span></>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={SHEET_LINK}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-panel px-3 py-2 text-xs text-muted shadow-ring transition-colors hover:border-borderStrong hover:text-text"
          >
            Open source sheet
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17 17 7" /><path d="M7 7h10v10" />
            </svg>
          </a>
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

      {/* YTD KPIs */}
      <section>
        <h2 className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
          Year to date
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Kpi label="Cleaning Revenue" value={data.ytd.revenue} />
          <Kpi label="Cleaning Cost"    value={data.ytd.cost}    tone="bad" />
          <Kpi label="Net P&L"          value={data.ytd.netPnl}  tone={data.ytd.netPnl.startsWith("(") ? "bad" : "good"} sub={`Margin ${data.ytd.margin}`} />
          <Kpi label="Avg Cost / Clean" value={data.ytd.avgCostPerClean ?? "—"} sub="weekly average" tone="accent" />
        </div>
      </section>

      {/* View toggle */}
      <div className="inline-flex rounded-lg border border-border bg-panel p-1 shadow-ring">
        {VIEWS.map((v) => {
          const active = v.id === view;
          return (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={
                "rounded-md px-4 py-1.5 text-xs font-medium transition-all duration-150 " +
                (active
                  ? "bg-accent text-white shadow-soft"
                  : "text-muted hover:text-text")
              }
            >
              {v.label}
              <span className="ml-2 text-[10px] opacity-70">{v.sub}</span>
            </button>
          );
        })}
      </div>

      <section className="space-y-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
          {activeView.label} · {activeView.sub}
        </h3>
        <CleaningTable data={activeTable} />
      </section>
    </main>
  );
}

function Kpi({
  label, value, sub, tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "good" | "bad" | "accent";
}) {
  const valCls =
    tone === "good"   ? "text-good"
    : tone === "bad"  ? "text-bad"
    : tone === "accent" ? "text-accent"
    : "text-text";
  const accentBar =
    tone === "good" ? "bg-good"
    : tone === "bad" ? "bg-bad"
    : tone === "accent" ? "bg-accent"
    : "bg-borderStrong";
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-panel p-5 shadow-soft transition-colors hover:border-borderStrong">
      <div className={"absolute inset-x-0 top-0 h-px opacity-50 " + accentBar} />
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
        {label}
      </div>
      <div className={`mt-2 text-display tabular-nums font-semibold ${valCls}`}>
        {value || "—"}
      </div>
      {sub && <div className="mt-1.5 text-[11px] text-muted">{sub}</div>}
    </div>
  );
}
