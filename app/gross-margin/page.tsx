"use client";
import { useEffect, useMemo, useState } from "react";
import { GrossMarginChart } from "@/components/GrossMarginChart";
import type { GrossMarginData, PropertyGmRow } from "@/lib/grossMargin";

const fmt = (n: number, compact = false) => {
  if (compact && Math.abs(n) >= 1000) {
    const k = Math.abs(n) / 1000;
    const s = `$${k >= 100 ? k.toFixed(0) : k >= 10 ? k.toFixed(1) : k.toFixed(1)}K`;
    return n < 0 ? `(${s})` : s;
  }
  const s = `$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return n < 0 ? `(${s})` : s;
};

type SortKey = "name" | "janGm1" | "febGm1" | "marGm1" | "threeMonthGm1" | "threeMonthMarginPct";

export default function GrossMarginPage() {
  const [data, setData] = useState<GrossMarginData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("threeMonthGm1");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  async function load() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/gross-margin", { cache: "no-store" });
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
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  }

  const sorted = useMemo(() => {
    if (!data) return [];
    return [...data.properties].sort((a, b) => {
      const av = sortKey === "name" ? a.name : a[sortKey as keyof PropertyGmRow] as number;
      const bv = sortKey === "name" ? b.name : b[sortKey as keyof PropertyGmRow] as number;
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [data, sortKey, sortDir]);

  if (error) return (
    <main className="mx-auto max-w-7xl p-8">
      <div className="rounded-xl border border-bad/40 bg-bad/5 p-5 text-bad">Error loading gross margin data: {error}</div>
    </main>
  );

  if (!data) return <PageSkeleton />;

  const [jan, feb, mar] = data.months;
  const { threeMonth, portfolio } = data;

  // Insight: biggest March jump
  const marVsJan = jan.gm1 > 0 ? Math.round((mar.gm1 / jan.gm1 - 1) * 100) : 0;
  const negProps = data.properties.filter(p => p.threeMonthGm1 < 0);
  const topProp = data.properties[0];

  return (
    <main className="mx-auto max-w-7xl space-y-10 px-6 py-10 animate-fade-in">

      {/* ── Hero ── */}
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
            Gross Margin 1
          </p>
          <h1 className="mt-2 text-display-lg tracking-tight text-text">
            Jan – Mar 2026
            <span className="ml-3 text-display text-muted font-normal">·</span>
            <span className="ml-3 text-display text-good font-semibold tabular-nums">{threeMonth.marginPct}%</span>
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            M Portfolio · {threeMonth.units} units · Gross Revenue − Platform Fees − Period Rent = GM1 ·{" "}
            <span className="text-text">synced {new Date(data.generatedAt).toLocaleTimeString()}</span>
          </p>
        </div>
        <button
          onClick={load} disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-panel px-3 py-2 text-sm text-text shadow-ring hover:border-borderStrong disabled:opacity-50 transition-colors"
        >
          <svg className={refreshing ? "animate-spin text-accent" : "text-muted"} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><polyline points="21 3 21 8 16 8" />
          </svg>
          {refreshing ? "Refreshing" : "Refresh"}
        </button>
      </section>

      {/* ── Portfolio Summary Header (Jan–Mar only) ── */}
      <section className="space-y-4">
        {/* 4-column KPI strip */}
        <div className="overflow-hidden rounded-2xl border border-border shadow-soft">
          <div className="grid grid-cols-2 md:grid-cols-4 bg-[#111c35]">
            {[
              { label: "M NET REVENUE",    cls: "border-r border-white/10" },
              { label: "M PLATFORM FEES",  cls: "border-r border-white/10" },
              { label: "M PERIOD RENT",    cls: "border-r border-white/10" },
              { label: "M GROSS MARGIN 1", cls: "bg-[#1a4d3b]" },
            ].map(({ label, cls }) => (
              <div key={label} className={`px-6 py-3.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white/70 ${cls}`}>
                {label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 bg-panel divide-x divide-border">
            {/* Net Revenue = sum of monthly net revenues (Jan–Mar) */}
            <div className="px-6 py-5">
              <div className="tabular-nums text-2xl font-bold text-good">{fmt(threeMonth.netRevenue)}</div>
              <div className="mt-2 text-[11px] italic text-muted">Airbnb + Other gross (Jan–Mar)</div>
            </div>
            {/* Platform Fees: full-period figure from sheet — monthly split not available */}
            <div className="px-6 py-5">
              <div className="tabular-nums text-2xl font-bold text-bad">{fmt(portfolio.platformFees)}</div>
              <div className="mt-2 text-[11px] italic text-muted">Service fees + channel commission</div>
            </div>
            {/* Period Rent = Net Revenue − GM1, Jan–Mar */}
            <div className="px-6 py-5">
              <div className="tabular-nums text-2xl font-bold text-text">{fmt(threeMonth.netRevenue - threeMonth.gm1)}</div>
              <div className="mt-2 text-[11px] italic text-muted">Pro-rated by month with revenue</div>
            </div>
            {/* GM1 and margin, Jan–Mar */}
            <div className="px-6 py-5">
              <div className="tabular-nums text-2xl font-bold text-good">{fmt(threeMonth.gm1)}</div>
              <div className="mt-2 text-[11px] text-muted">
                <span className="font-bold text-good">{threeMonth.marginPct}%</span> GM1 Margin
              </div>
            </div>
          </div>
        </div>

        {/* Monthly breakdown table */}
        <div className="overflow-hidden rounded-2xl border border-border bg-panel shadow-soft">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#111c35]">
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-white/70 border-r border-white/10 w-36">Month</th>
                <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-[0.16em] text-white/70 border-r border-white/10">Net Revenue</th>
                <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-[0.16em] text-white/70 border-r border-white/10">Period Rent</th>
                <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-[0.16em] text-white/70 border-r border-white/10">GM1</th>
                <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-[0.16em] text-white/70">Margin %</th>
              </tr>
            </thead>
            <tbody>
              {[jan, feb, mar].map((m, i) => {
                const rent = m.netRevenue - m.gm1;
                const marginTone = m.marginPct >= 30 ? "text-good" : m.marginPct >= 10 ? "text-warn" : "text-bad";
                const isBreakout = i === 2;
                return (
                  <tr key={m.month} className={`${i < 2 ? "border-b border-border/50" : ""} ${isBreakout ? "bg-good/5" : "hover:bg-panel2/30"} transition-colors`}>
                    <td className="px-5 py-3.5 font-semibold text-text border-r border-border/40">
                      {m.month}
                      {isBreakout && <span className="ml-2 text-[9px] font-bold uppercase tracking-wider text-good">Best</span>}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-text border-r border-border/40">{fmt(m.netRevenue)}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-muted border-r border-border/40">{fmt(rent)}</td>
                    <td className={`px-5 py-3.5 text-right tabular-nums font-semibold border-r border-border/40 ${m.gm1 >= 0 ? "text-good" : "text-bad"}`}>{fmt(m.gm1)}</td>
                    <td className={`px-5 py-3.5 text-right tabular-nums font-bold ${marginTone}`}>{m.marginPct}%</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-border bg-panel2/60 font-semibold text-sm">
                <td className="px-5 py-3.5 text-text border-r border-border/40">3-Month Total</td>
                <td className="px-5 py-3.5 text-right tabular-nums text-text border-r border-border/40">{fmt(threeMonth.netRevenue)}</td>
                <td className="px-5 py-3.5 text-right tabular-nums text-muted border-r border-border/40">{fmt(threeMonth.netRevenue - threeMonth.gm1)}</td>
                <td className="px-5 py-3.5 text-right tabular-nums text-good border-r border-border/40">{fmt(threeMonth.gm1)}</td>
                <td className={`px-5 py-3.5 text-right tabular-nums font-bold ${threeMonth.marginPct >= 30 ? "text-good" : threeMonth.marginPct >= 10 ? "text-warn" : "text-bad"}`}>{threeMonth.marginPct}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 3-Month KPIs ── */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <BigKpi
          label="3-Mo Net Revenue"
          value={fmt(threeMonth.netRevenue)}
          sub="Jan + Feb + Mar"
          tone="default"
        />
        <BigKpi
          label="3-Mo GM1"
          value={fmt(threeMonth.gm1)}
          sub={`${threeMonth.marginPct}% overall margin`}
          tone="good"
        />
        <BigKpi
          label="Best Month"
          value={fmt(mar.gm1)}
          sub={`March · ${mar.marginPct}% margin`}
          tone="accent"
        />
        <BigKpi
          label="Properties Tracked"
          value={String(data.properties.length)}
          sub={negProps.length > 0 ? `${negProps.length} with negative GM1` : "all profitable"}
          tone={negProps.length > 0 ? "warn" : "good"}
        />
      </section>

      {/* ── Insight banner ── */}
      {marVsJan > 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-good/25 bg-gradient-to-br from-good/10 via-good/5 to-transparent px-6 py-5">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-good/50 to-transparent" />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-good">March Breakout</p>
              <p className="mt-1 text-lg font-semibold text-text">
                GM1 grew <span className="text-good">+{marVsJan}%</span> from January to March
              </p>
              <p className="mt-0.5 text-sm text-muted">
                {fmt(jan.gm1)} → {fmt(feb.gm1)} → {fmt(mar.gm1)} ·
                margin jumped from {jan.marginPct}% to {mar.marginPct}%
              </p>
            </div>
            {topProp && (
              <div className="rounded-xl border border-border bg-panel/60 px-4 py-3 text-right">
                <p className="text-[10px] uppercase tracking-wider text-muted">Top performer</p>
                <p className="mt-0.5 font-semibold text-text">{topProp.name}</p>
                <p className="text-sm text-good">{fmt(topProp.threeMonthGm1)} · {topProp.threeMonthMarginPct}%</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Monthly Trajectory ── */}
      <section>
        <h2 className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
          Monthly Performance
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[jan, feb, mar].map((m, i) => {
            const isBreakout = i === 2;
            const prevMargin = i > 0 ? data.months[i - 1].marginPct : null;
            const delta = prevMargin !== null ? m.marginPct - prevMargin : null;
            const marginTone = m.marginPct >= 30 ? "good" : m.marginPct >= 10 ? "warn" : "bad";
            const barColor = marginTone === "good" ? "bg-good" : marginTone === "warn" ? "bg-warn" : "bg-bad";
            return (
              <div
                key={m.month}
                className={`relative overflow-hidden rounded-2xl border p-6 shadow-soft transition-all ${
                  isBreakout
                    ? "border-good/40 bg-gradient-to-br from-good/10 via-good/5 to-panel"
                    : "border-border bg-panel hover:border-borderStrong"
                }`}
              >
                {isBreakout && (
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-good/60 to-transparent" />
                )}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                      {m.month}
                    </p>
                    {isBreakout && (
                      <span className="mt-1 inline-block rounded-full border border-good/30 bg-good/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-good">
                        Best Month
                      </span>
                    )}
                  </div>
                  {delta !== null && (
                    <span className={`text-xs font-semibold ${delta >= 0 ? "text-good" : "text-bad"}`}>
                      {delta >= 0 ? "↑" : "↓"} {Math.abs(delta).toFixed(1)}pp
                    </span>
                  )}
                </div>

                <div className="mt-5 space-y-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-muted">Net Revenue</span>
                    <span className="tabular-nums font-semibold text-text">{fmt(m.netRevenue)}</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-muted">Gross Margin 1</span>
                    <span className={`tabular-nums text-lg font-bold ${marginTone === "good" ? "text-good" : marginTone === "warn" ? "text-warn" : "text-bad"}`}>
                      {fmt(m.gm1)}
                    </span>
                  </div>
                </div>

                {/* Margin progress bar */}
                <div className="mt-5">
                  <div className="mb-1.5 flex justify-between text-[10px]">
                    <span className="text-faint">GM1 Margin</span>
                    <span className={`font-bold tabular-nums ${marginTone === "good" ? "text-good" : marginTone === "warn" ? "text-warn" : "text-bad"}`}>
                      {m.marginPct}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-panel3">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                      style={{ width: `${Math.min(100, Math.max(0, m.marginPct))}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Chart ── */}
      <section className="rounded-2xl border border-border bg-panel p-6 shadow-soft">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
              Revenue vs GM1
            </h2>
            <p className="mt-0.5 text-[11px] text-faint">
              Bars: Net Revenue (faint) + GM1 (solid) · Line: Margin %
            </p>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-muted">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-accent/30" />Net Revenue
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-good" />GM1
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 bg-warn" />Margin %
            </span>
          </div>
        </div>
        <GrossMarginChart months={data.months} />
      </section>

      {/* ── Property Breakdown ── */}
      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
            Property Breakdown — Jan–Mar 2026
          </h2>
          <span className="text-[11px] text-faint">{data.properties.length} properties · click headers to sort</span>
        </div>

        <div className="rounded-2xl border border-border bg-panel shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="sticky top-0 z-10 bg-panel/95 backdrop-blur border-b border-border">
                <tr className="text-[10px] uppercase tracking-wider text-faint">
                  <Th onClick={() => toggleSort("name")} active={sortKey === "name"} dir={sortDir}>Property</Th>
                  <th className="px-4 py-3 text-right font-medium">Units</th>
                  <Th onClick={() => toggleSort("janGm1")} active={sortKey === "janGm1"} dir={sortDir} right>Jan GM1</Th>
                  <Th onClick={() => toggleSort("febGm1")} active={sortKey === "febGm1"} dir={sortDir} right>Feb GM1</Th>
                  <Th onClick={() => toggleSort("marGm1")} active={sortKey === "marGm1"} dir={sortDir} right>Mar GM1</Th>
                  <Th onClick={() => toggleSort("threeMonthGm1")} active={sortKey === "threeMonthGm1"} dir={sortDir} right>3-Mo GM1</Th>
                  <Th onClick={() => toggleSort("threeMonthMarginPct")} active={sortKey === "threeMonthMarginPct"} dir={sortDir} right>Margin %</Th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((p, i) => {
                  const isNeg = p.threeMonthGm1 < 0;
                  const isTop = i === 0 && p.threeMonthGm1 > 0;
                  return (
                    <tr
                      key={p.name}
                      className={`border-t border-border/40 transition-colors ${
                        isNeg ? "hover:bg-bad/5" : "hover:bg-panel2/40"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isTop && <span className="text-warn text-xs">★</span>}
                          <span className={`font-medium ${isNeg ? "text-bad" : "text-text"}`}>{p.name}</span>
                          {p.units > 1 && (
                            <span className="rounded-md bg-panel2 px-1.5 py-0.5 text-[10px] text-faint">{p.units}u</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted text-xs">{p.units}</td>
                      <Gm1Cell value={p.janGm1} />
                      <Gm1Cell value={p.febGm1} />
                      <Gm1Cell value={p.marGm1} />
                      <td className={`px-4 py-3 text-right tabular-nums font-semibold ${isNeg ? "text-bad" : "text-good"}`}>
                        {fmt(p.threeMonthGm1)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <MarginBadge pct={p.threeMonthMarginPct} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Totals row */}
              <tfoot className="border-t-2 border-border bg-panel2/60">
                <tr className="text-sm font-semibold">
                  <td className="px-4 py-3 text-text">Portfolio Total</td>
                  <td className="px-4 py-3 text-right text-muted text-xs">{threeMonth.units}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-text">{fmt(jan.gm1)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-text">{fmt(feb.gm1)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-good">{fmt(mar.gm1)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-good">{fmt(threeMonth.gm1)}</td>
                  <td className="px-4 py-3 text-right">
                    <MarginBadge pct={threeMonth.marginPct} bold />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {negProps.length > 0 && (
          <p className="mt-2 px-1 text-[11px] text-faint">
            {negProps.length} propert{negProps.length === 1 ? "y" : "ies"} with negative 3-month GM1:{" "}
            {negProps.map(p => p.name).join(", ")}
          </p>
        )}
      </section>
    </main>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function BigKpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: "default" | "good" | "bad" | "accent" | "warn" }) {
  const valCls = tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : tone === "accent" ? "text-accent" : tone === "warn" ? "text-warn" : "text-text";
  const bar    = tone === "good" ? "bg-good" : tone === "bad" ? "bg-bad" : tone === "accent" ? "bg-accent" : tone === "warn" ? "bg-warn" : "bg-borderStrong";
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-panel p-5 shadow-soft transition-colors hover:border-borderStrong">
      <div className={`absolute inset-x-0 top-0 h-px opacity-60 ${bar}`} />
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</div>
      <div className={`mt-2 text-display tabular-nums font-semibold ${valCls}`}>{value}</div>
      {sub && <div className="mt-1.5 text-[11px] text-muted">{sub}</div>}
    </div>
  );
}

function Th({ children, onClick, active, dir, right }: {
  children: React.ReactNode; onClick: () => void;
  active: boolean; dir: "asc" | "desc"; right?: boolean;
}) {
  return (
    <th
      className={`px-4 py-3 font-medium cursor-pointer select-none transition-colors hover:text-text ${right ? "text-right" : "text-left"} ${active ? "text-accent" : ""}`}
      onClick={onClick}
    >
      {children}
      {active && <span className="ml-1">{dir === "desc" ? "↓" : "↑"}</span>}
    </th>
  );
}

function Gm1Cell({ value }: { value: number }) {
  if (value === 0) return <td className="px-4 py-3 text-right tabular-nums text-faint">—</td>;
  const isNeg = value < 0;
  return (
    <td className={`px-4 py-3 text-right tabular-nums text-xs ${isNeg ? "text-bad" : "text-muted"}`}>
      {fmt(value)}
    </td>
  );
}

function MarginBadge({ pct, bold }: { pct: number; bold?: boolean }) {
  const tone = pct >= 30 ? "border-good/30 bg-good/10 text-good"
    : pct >= 10 ? "border-warn/30 bg-warn/10 text-warn"
    : pct > 0   ? "border-accent/30 bg-accent/10 text-accent"
    : "border-bad/30 bg-bad/10 text-bad";
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] tabular-nums ${bold ? "font-bold" : "font-medium"} ${tone}`}>
      {pct}%
    </span>
  );
}

function PageSkeleton() {
  return (
    <main className="mx-auto max-w-7xl space-y-10 px-6 py-10">
      <div className="space-y-3">
        <div className="skeleton h-3 w-24" />
        <div className="skeleton h-10 w-72" />
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-28" />)}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-48" />)}
      </div>
      <div className="skeleton h-80" />
      <div className="skeleton h-96" />
    </main>
  );
}
