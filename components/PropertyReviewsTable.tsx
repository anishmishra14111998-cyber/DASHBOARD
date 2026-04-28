"use client";
import { useMemo, useState } from "react";

export interface PropertyReviewRow {
  propertyId: string;
  propertyName: string;
  count: number;
  avgRating: number;       // 0..5
  withRating: number;
  positive: number;        // 4+
  negative: number;        // <=2
  latestDate: string;      // ISO
  topChannel: string;      // human label
}

type SortKey =
  | "propertyName"
  | "count"
  | "avgRating"
  | "positive"
  | "negative"
  | "latestDate";

const COLS: { key: SortKey; label: string; align: "left" | "right" }[] = [
  { key: "propertyName", label: "Property",      align: "left"  },
  { key: "count",        label: "Reviews",       align: "right" },
  { key: "avgRating",    label: "Avg Rating",    align: "right" },
  { key: "positive",     label: "Positive (4+)", align: "right" },
  { key: "negative",     label: "Negative (≤2)", align: "right" },
  { key: "latestDate",   label: "Latest",        align: "right" },
];

function ratingTone(avg: number): { color: string; bar: string } {
  if (avg >= 4.5) return { color: "text-good", bar: "bg-good" };
  if (avg >= 4.0) return { color: "text-text", bar: "bg-accent" };
  if (avg >= 3.0) return { color: "text-warn", bar: "bg-warn" };
  if (avg >  0)   return { color: "text-bad",  bar: "bg-bad" };
  return            { color: "text-faint", bar: "bg-borderStrong" };
}

function fmtDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
}

export function PropertyReviewsTable({
  data, rangeLabel,
}: { data: PropertyReviewRow[]; rangeLabel: string }) {
  const [sortKey, setSortKey] = useState<SortKey>("count");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [query, setQuery] = useState("");

  const sorted = useMemo(() => {
    const filtered = query.trim()
      ? data.filter((r) => r.propertyName.toLowerCase().includes(query.toLowerCase()))
      : data;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [data, sortKey, sortDir, query]);

  function clickHeader(k: SortKey) {
    if (k === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir(k === "propertyName" ? "asc" : "desc"); }
  }

  const totals = sorted.reduce(
    (s, r) => ({
      count: s.count + r.count,
      withRating: s.withRating + r.withRating,
      ratingSum: s.ratingSum + r.avgRating * r.withRating,
      positive: s.positive + r.positive,
      negative: s.negative + r.negative,
    }),
    { count: 0, withRating: 0, ratingSum: 0, positive: 0, negative: 0 }
  );
  const portfolioAvg = totals.withRating > 0 ? totals.ratingSum / totals.withRating : 0;

  return (
    <section className="rounded-xl border border-border bg-panel shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
            Per-property reviews
          </p>
          <h2 className="mt-1 text-base font-semibold tracking-tight text-text">
            {data.length} properties · sortable
          </h2>
          <p className="mt-0.5 text-[11px] text-muted">{rangeLabel}</p>
        </div>
        <div className="relative">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search property…"
            className="w-64 rounded-lg border border-border bg-panel2 py-2 pl-9 pr-3 text-xs text-text placeholder:text-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </div>
      </div>

      <div className="overflow-auto border-t border-border/60">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="sticky top-0 z-10 bg-panel/95 backdrop-blur">
            <tr className="text-[11px] uppercase tracking-wider text-faint">
              {COLS.map((c) => {
                const active = c.key === sortKey;
                const arrow = active ? (sortDir === "asc" ? "▲" : "▼") : "";
                return (
                  <th
                    key={c.key}
                    onClick={() => clickHeader(c.key)}
                    className={
                      "cursor-pointer select-none border-b border-border px-4 py-3 font-medium transition-colors hover:text-text " +
                      (c.align === "right" ? "text-right" : "text-left") +
                      (active ? " text-text" : "")
                    }
                  >
                    {c.label}{arrow && <span className="ml-1 text-accent">{arrow}</span>}
                  </th>
                );
              })}
              <th className="border-b border-border px-4 py-3 text-left font-medium">Top Channel</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const tone = ratingTone(r.avgRating);
              const widthPct = Math.max(2, Math.min(100, (r.avgRating / 5) * 100));
              return (
                <tr key={r.propertyId} className="border-t border-border/40 transition-colors hover:bg-panel2/50">
                  <td className="max-w-[280px] truncate px-4 py-3 text-text">
                    {r.propertyName}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.count.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <div className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-panel3 md:block">
                        <div className={"h-full " + tone.bar} style={{ width: `${widthPct}%` }} />
                      </div>
                      <span className={"w-12 text-right tabular-nums font-medium " + tone.color}>
                        {r.avgRating > 0 ? r.avgRating.toFixed(2) : "—"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-good">
                    {r.positive || <span className="text-faint">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-bad">
                    {r.negative || <span className="text-faint">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">
                    {fmtDate(r.latestDate)}
                  </td>
                  <td className="px-4 py-3 text-muted">{r.topChannel}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-panel2/40 text-sm font-semibold">
              <td className="px-4 py-3">Totals</td>
              <td className="px-4 py-3 text-right tabular-nums">{totals.count}</td>
              <td className="px-4 py-3 text-right tabular-nums">
                {portfolioAvg > 0 ? portfolioAvg.toFixed(2) : "—"}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-good">{totals.positive}</td>
              <td className="px-4 py-3 text-right tabular-nums text-bad">{totals.negative}</td>
              <td className="px-4 py-3 text-right text-muted">—</td>
              <td className="px-4 py-3 text-muted">{sorted.length} properties</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
