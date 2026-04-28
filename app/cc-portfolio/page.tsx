"use client";
import { useEffect, useMemo, useState } from "react";
import type { CCPortfolioData, CCPropertyGroup } from "@/lib/ccPortfolio";

const fmt = (n: number) => {
  const s = `$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return n < 0 ? `(${s})` : s;
};
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

type SortKey = "name" | "threeMonthGross" | "threeMonthFees" | "threeMonthNet" | "feeRatePct";

const MONTH_COLORS = ["#5b8cff", "#818cf8", "#34d399"] as const;

export default function CCPortfolioPage() {
  const [data, setData]         = useState<CCPortfolioData | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sortKey, setSortKey]   = useState<SortKey>("threeMonthNet");
  const [sortDir, setSortDir]   = useState<"asc" | "desc">("desc");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  async function load() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/cc-portfolio", { cache: "no-store" });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      setData(await res.json());
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); const id = setInterval(load, 30_000); return () => clearInterval(id); }, []);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  }

  function toggleExpand(name: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  const sorted = useMemo(() => {
    if (!data) return [];
    return [...data.properties].sort((a, b) => {
      const av = sortKey === "name" ? a.name : a[sortKey] as number;
      const bv = sortKey === "name" ? b.name : b[sortKey] as number;
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [data, sortKey, sortDir]);

  if (error) return (
    <main className="mx-auto max-w-7xl p-8">
      <div className="rounded-xl border border-bad/40 bg-bad/5 p-5 text-bad">Error: {error}</div>
    </main>
  );
  if (!data) return <PageSkeleton />;

  const { threeMonth, months } = data;
  const [jan, feb, mar] = months;
  const feeRatePct = threeMonth.gross > 0
    ? Math.round((Math.abs(threeMonth.fees) / threeMonth.gross) * 1000) / 10 : 0;
  const topProp = sorted[0];

  return (
    <main className="mx-auto max-w-7xl space-y-10 px-6 py-10 animate-fade-in">

      {/* ── Hero ── */}
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
            CC Portfolio · Co-hosting
          </p>
          <h1 className="mt-2 text-display-lg tracking-tight text-text">
            Monthly Revenue
            <span className="ml-3 text-display text-muted font-normal">·</span>
            <span className="ml-3 text-display text-good font-semibold tabular-nums">{fmt(threeMonth.net)}</span>
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            Jan–Mar 2026 · {threeMonth.unitCount} units · {threeMonth.propertyCount} properties ·{" "}
            {fmtPct(feeRatePct)} avg platform fee ·{" "}
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

      {/* ── Portfolio KPI Strip ── */}
      <section className="space-y-4">
        <div className="overflow-hidden rounded-2xl border border-border shadow-soft">
          {/* Header labels */}
          <div className="grid grid-cols-2 md:grid-cols-4 bg-[#111c35]">
            {[
              { label: "GROSS REVENUE",   cls: "border-r border-white/10" },
              { label: "PLATFORM FEES",   cls: "border-r border-white/10" },
              { label: "NET REVENUE",     cls: "border-r border-white/10" },
              { label: "PORTFOLIO",       cls: "bg-[#1a3a5c]" },
            ].map(({ label, cls }) => (
              <div key={label} className={`px-6 py-3.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white/70 ${cls}`}>
                {label}
              </div>
            ))}
          </div>
          {/* Values */}
          <div className="grid grid-cols-2 md:grid-cols-4 bg-panel divide-x divide-border">
            <div className="px-6 py-5">
              <div className="tabular-nums text-2xl font-bold text-good">{fmt(threeMonth.gross)}</div>
              <div className="mt-2 text-[11px] italic text-muted">Airbnb + other platforms (Jan–Mar)</div>
            </div>
            <div className="px-6 py-5">
              <div className="tabular-nums text-2xl font-bold text-bad">{fmt(threeMonth.fees)}</div>
              <div className="mt-2 text-[11px] italic text-muted">{fmtPct(feeRatePct)} avg · service + channel</div>
            </div>
            <div className="px-6 py-5">
              <div className="tabular-nums text-2xl font-bold text-accent">{fmt(threeMonth.net)}</div>
              <div className="mt-2 text-[11px] italic text-muted">No rent deducted · pure co-host share</div>
            </div>
            <div className="px-6 py-5">
              <div className="tabular-nums text-2xl font-bold text-text">{threeMonth.unitCount}</div>
              <div className="mt-2 text-[11px] text-muted">
                units across <span className="font-semibold text-text">{threeMonth.propertyCount}</span> properties
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
                <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-[0.16em] text-white/70 border-r border-white/10">Gross Revenue</th>
                <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-[0.16em] text-white/70 border-r border-white/10">Platform Fees</th>
                <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-[0.16em] text-white/70 border-r border-white/10">Net Revenue</th>
                <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-[0.16em] text-white/70">Fee Rate</th>
              </tr>
            </thead>
            <tbody>
              {[jan, feb, mar].map((m, i) => {
                const feeRate = m.gross > 0 ? Math.round((Math.abs(m.fees) / m.gross) * 1000) / 10 : 0;
                const color   = MONTH_COLORS[i];
                return (
                  <tr key={m.month} className={`${i < 2 ? "border-b border-border/50" : ""} hover:bg-panel2/30 transition-colors`}>
                    <td className="px-5 py-3.5 border-r border-border/40">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <span className="font-semibold text-text">{m.month}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-good border-r border-border/40">{fmt(m.gross)}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-bad border-r border-border/40">{fmt(m.fees)}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums font-semibold text-accent border-r border-border/40">{fmt(m.net)}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-muted">{fmtPct(feeRate)}</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-border bg-panel2/60 font-semibold text-sm">
                <td className="px-5 py-3.5 text-text border-r border-border/40">3-Month Total</td>
                <td className="px-5 py-3.5 text-right tabular-nums text-good border-r border-border/40">{fmt(threeMonth.gross)}</td>
                <td className="px-5 py-3.5 text-right tabular-nums text-bad border-r border-border/40">{fmt(threeMonth.fees)}</td>
                <td className="px-5 py-3.5 text-right tabular-nums text-accent border-r border-border/40">{fmt(threeMonth.net)}</td>
                <td className="px-5 py-3.5 text-right tabular-nums text-muted">{fmtPct(feeRatePct)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Insight banner ── */}
      {topProp && (
        <div className="relative overflow-hidden rounded-2xl border border-accent/25 bg-gradient-to-br from-accent/10 via-accent/5 to-transparent px-6 py-5">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent" />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Portfolio Snapshot · Jan–Mar 2026</p>
              <p className="mt-1 text-lg font-semibold text-text">
                <span className="text-accent">{fmt(threeMonth.net)}</span> net revenue across {threeMonth.unitCount} co-hosted units
              </p>
              <p className="mt-0.5 text-sm text-muted">
                {fmt(jan.net)} Jan → {fmt(feb.net)} Feb → {fmt(mar.net)} Mar ·{" "}
                {fmtPct(feeRatePct)} blended platform fee
              </p>
            </div>
            <div className="rounded-xl border border-border bg-panel/60 px-4 py-3 text-right">
              <p className="text-[10px] uppercase tracking-wider text-muted">Top property</p>
              <p className="mt-0.5 font-semibold text-text">{topProp.name}</p>
              <p className="text-sm text-accent">{fmt(topProp.threeMonthNet)} net · {topProp.units.length} unit{topProp.units.length > 1 ? "s" : ""}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Property Breakdown ── */}
      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
            Property Breakdown — Jan–Mar 2026
          </h2>
          <span className="text-[11px] text-faint">{threeMonth.propertyCount} properties · {threeMonth.unitCount} units · click row to expand units · click headers to sort</span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-panel shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead className="sticky top-0 z-10 bg-panel/95 backdrop-blur border-b border-border">
                <tr className="text-[10px] uppercase tracking-wider text-faint">
                  <Th onClick={() => toggleSort("name")} active={sortKey === "name"} dir={sortDir}>Property</Th>
                  <th className="px-4 py-3 text-right font-medium">Units</th>
                  <Th onClick={() => toggleSort("threeMonthGross")} active={sortKey === "threeMonthGross"} dir={sortDir} right>3-Mo Gross</Th>
                  <Th onClick={() => toggleSort("threeMonthFees")} active={sortKey === "threeMonthFees"} dir={sortDir} right>3-Mo Fees</Th>
                  <Th onClick={() => toggleSort("threeMonthNet")} active={sortKey === "threeMonthNet"} dir={sortDir} right>3-Mo Net</Th>
                  <Th onClick={() => toggleSort("feeRatePct")} active={sortKey === "feeRatePct"} dir={sortDir} right>Fee Rate</Th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((p, i) => {
                  const isTop = i === 0;
                  const isExpanded = expanded.has(p.name);
                  const multiUnit = p.units.length > 1;
                  return (
                    <>
                      <tr
                        key={p.name}
                        onClick={() => multiUnit && toggleExpand(p.name)}
                        className={`border-t border-border/40 transition-colors ${multiUnit ? "cursor-pointer hover:bg-accent/5" : "hover:bg-panel2/30"}`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {multiUnit && (
                              <span className="text-faint text-xs transition-transform duration-150" style={{ display: "inline-block", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
                            )}
                            {isTop && <span className="text-warn text-xs">★</span>}
                            <span className="font-medium text-text">{p.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted text-xs">{p.units.length}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-good text-xs">{fmt(p.threeMonthGross)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-bad text-xs">{fmt(p.threeMonthFees)}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-accent">{fmt(p.threeMonthNet)}</td>
                        <td className="px-4 py-3 text-right">
                          <FeeBadge pct={p.feeRatePct} />
                        </td>
                      </tr>
                      {/* Expanded unit rows */}
                      {isExpanded && p.units.map(u => (
                        <tr key={`${p.name}-${u.unit}`} className="border-t border-border/20 bg-panel2/30">
                          <td className="px-4 py-2 pl-10">
                            <span className="text-xs text-muted">Unit {u.unit}</span>
                          </td>
                          <td className="px-4 py-2 text-right text-faint text-xs">—</td>
                          <td className="px-4 py-2 text-right tabular-nums text-good text-xs">{u.threeMonthGross > 0 ? fmt(u.threeMonthGross) : <span className="text-faint">—</span>}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-bad text-xs">{u.threeMonthFees !== 0 ? fmt(u.threeMonthFees) : <span className="text-faint">—</span>}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-accent text-xs">{u.threeMonthNet > 0 ? fmt(u.threeMonthNet) : <span className="text-faint">—</span>}</td>
                          <td className="px-4 py-2 text-right text-faint text-xs">—</td>
                        </tr>
                      ))}
                    </>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-border bg-panel2/60">
                <tr className="text-sm font-semibold">
                  <td className="px-4 py-3 text-text">CC Portfolio Total</td>
                  <td className="px-4 py-3 text-right text-muted text-xs">{threeMonth.unitCount}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-good">{fmt(threeMonth.gross)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-bad">{fmt(threeMonth.fees)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-accent">{fmt(threeMonth.net)}</td>
                  <td className="px-4 py-3 text-right">
                    <FeeBadge pct={feeRatePct} bold />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Th({ children, onClick, active, dir, right }: {
  children: React.ReactNode; onClick: () => void;
  active: boolean; dir: "asc" | "desc"; right?: boolean;
}) {
  return (
    <th
      className={`px-4 py-3 font-medium cursor-pointer select-none transition-colors hover:text-text ${right ? "text-right" : "text-left"} ${active ? "text-accent" : ""}`}
      onClick={onClick}
    >
      {children}{active && <span className="ml-1">{dir === "desc" ? "↓" : "↑"}</span>}
    </th>
  );
}

function FeeBadge({ pct, bold }: { pct: number; bold?: boolean }) {
  const tone = pct <= 12 ? "border-good/30 bg-good/10 text-good"
    : pct <= 16 ? "border-warn/30 bg-warn/10 text-warn"
    : "border-bad/30 bg-bad/10 text-bad";
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] tabular-nums ${bold ? "font-bold" : "font-medium"} ${tone}`}>
      {fmtPct(pct)}
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
      <div className="skeleton h-40" />
      <div className="skeleton h-48" />
      <div className="skeleton h-96" />
    </main>
  );
}
