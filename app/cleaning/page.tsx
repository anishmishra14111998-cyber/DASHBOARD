"use client";
import { useEffect, useState } from "react";
import { CleaningTable } from "@/components/CleaningTable";
import type { CleaningData } from "@/lib/cleaning";

const REFRESH_MS = 5 * 60 * 1000; // 5 minutes — matches server-side cache

type ViewKey = "monthly" | "weekly" | "costDetail";

const VIEWS: { id: ViewKey; label: string; sub: string }[] = [
  { id: "monthly",    label: "Monthly",         sub: "Jan – Apr 2026" },
  { id: "weekly",     label: "Weekly",          sub: "16 weeks · Jan 2 → Apr 24" },
  { id: "costDetail", label: "Cost Detail",     sub: "CLT vs RDU breakdown" },
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
    return () => clearInterval(id);
  }, []);

  if (error) {
    return (
      <main className="mx-auto max-w-7xl p-6">
        <div className="rounded-xl border border-bad bg-panel p-4 text-bad">
          Failed to load cleaning data: {error}
        </div>
      </main>
    );
  }
  if (!data) {
    return <main className="mx-auto max-w-7xl p-6 text-muted">Loading cleaning dashboard…</main>;
  }

  const activeTable =
    view === "monthly"    ? data.monthly :
    view === "weekly"     ? data.weekly  :
                            data.costDetail;
  const activeView = VIEWS.find((v) => v.id === view)!;

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Cleaning Dashboard</p>
          <p className="mt-1 text-sm text-muted">
            Live from Google Sheets · auto-refresh 5min ·{" "}
            <span className="text-text">{new Date(data.generatedAt).toLocaleTimeString()}</span>
            {data.period.portfolio && (
              <>
                {" · "}
                <span className="text-text">{data.period.portfolio}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={SHEET_LINK}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-border bg-panel px-3 py-2 text-xs text-muted hover:bg-panel2 hover:text-text"
          >
            Open source sheet ↗
          </a>
          <button
            onClick={load}
            disabled={refreshing}
            className="rounded-lg border border-border bg-panel px-3 py-2 text-sm text-text hover:bg-panel2 disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "Refresh now"}
          </button>
        </div>
      </header>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          Year-to-date · {data.period.monthly}
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Kpi label="YTD Cleaning Revenue" value={data.ytd.revenue} tone="default" />
          <Kpi label="YTD Cleaning Cost"    value={data.ytd.cost}    tone="bad" />
          <Kpi label="YTD Net P&L"          value={data.ytd.netPnl}  tone={data.ytd.netPnl.startsWith("(") ? "bad" : "good"} sub={`Margin ${data.ytd.margin}`} />
          <Kpi label="Avg Cost / Clean"     value={data.ytd.avgCostPerClean ?? "—"} sub="(weekly)" />
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {VIEWS.map((v) => {
          const active = v.id === view;
          return (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={
                "rounded-full px-4 py-1.5 text-xs font-medium transition-colors " +
                (active
                  ? "bg-gradient-to-r from-accent to-[#7a9eff] text-white shadow-lg shadow-accent/40"
                  : "border border-border bg-panel2/60 text-muted hover:border-accent/60 hover:text-text")
              }
            >
              {v.label}
              <span className="ml-2 text-[10px] opacity-70">{v.sub}</span>
            </button>
          );
        })}
      </div>

      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
          {activeView.label} · {activeView.sub}
        </h3>
        <CleaningTable data={activeTable} />
      </section>
    </main>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "good" | "bad";
}) {
  const valCls =
    tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : "text-text";
  return (
    <div className="rounded-xl border border-border bg-panel p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${valCls}`}>
        {value || "—"}
      </div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}
