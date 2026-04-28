"use client";
import { useMemo, useState } from "react";
import type { PropertyRow } from "@/lib/aggregate";

const fmt = (n: number) =>
  `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

type SortKey =
  | "propertyName"
  | "city"
  | "bookings"
  | "occupiedNights"
  | "occupancyPct"
  | "grossRevenue"
  | "commission"
  | "netPayout"
  | "adr";

const COLS: { key: SortKey; label: string; align: "left" | "right" }[] = [
  { key: "propertyName",   label: "Property",   align: "left"  },
  { key: "city",           label: "City",       align: "left"  },
  { key: "bookings",       label: "Bookings",   align: "right" },
  { key: "occupiedNights", label: "Nights",     align: "right" },
  { key: "occupancyPct",   label: "Occupancy",  align: "right" },
  { key: "grossRevenue",   label: "Gross",      align: "right" },
  { key: "commission",     label: "Commission", align: "right" },
  { key: "netPayout",      label: "Net Payout", align: "right" },
  { key: "adr",            label: "ADR",        align: "right" },
];

function occBar(pct: number): { color: string; bg: string } {
  if (pct >= 75) return { color: "text-good", bg: "bg-good" };
  if (pct >= 40) return { color: "text-text", bg: "bg-accent" };
  if (pct >  0)  return { color: "text-bad",  bg: "bg-bad" };
  return                  { color: "text-faint", bg: "bg-borderStrong" };
}

export function PropertyBreakdownTable({
  data,
  rangeLabel,
}: {
  data: PropertyRow[];
  rangeLabel: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("grossRevenue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [query, setQuery] = useState("");

  const sorted = useMemo(() => {
    const filtered = query.trim()
      ? data.filter(
          (r) =>
            r.propertyName.toLowerCase().includes(query.toLowerCase()) ||
            r.city.toLowerCase().includes(query.toLowerCase())
        )
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
    else { setSortKey(k); setSortDir(k === "propertyName" || k === "city" ? "asc" : "desc"); }
  }

  const totals = sorted.reduce(
    (s, r) => ({
      bookings: s.bookings + r.bookings,
      occupiedNights: s.occupiedNights + r.occupiedNights,
      grossRevenue: s.grossRevenue + r.grossRevenue,
      commission: s.commission + r.commission,
      netPayout: s.netPayout + r.netPayout,
    }),
    { bookings: 0, occupiedNights: 0, grossRevenue: 0, commission: 0, netPayout: 0 }
  );
  const totalDays = sorted.reduce((s, r) => s + r.daysInRange, 0);
  const totalsOcc = totalDays ? Math.round((totals.occupiedNights / totalDays) * 100) : 0;
  const totalsAdr = totals.occupiedNights > 0 ? Math.round(totals.grossRevenue / totals.occupiedNights) : 0;

  return (
    <section className="rounded-xl border border-border bg-panel shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
            Per-property breakdown
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
            placeholder="Search property or city…"
            className="w-64 rounded-lg border border-border bg-panel2 py-2 pl-9 pr-3 text-xs text-text placeholder:text-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </div>
      </div>

      <div className="overflow-auto border-t border-border/60">
        <table className="w-full min-w-[900px] text-sm">
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
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const occ = occBar(r.occupancyPct);
              const occWidth = Math.max(2, Math.min(100, r.occupancyPct));
              return (
                <tr key={r.propertyId} className="border-t border-border/40 transition-colors hover:bg-panel2/50">
                  <td className="max-w-[280px] truncate px-4 py-3 text-text">{r.propertyName}</td>
                  <td className="px-4 py-3 text-muted">{r.city}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.bookings || <span className="text-faint">—</span>}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">
                    {r.occupiedNights}<span className="text-faint">/{r.daysInRange}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <div className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-panel3 md:block">
                        <div className={"h-full " + occ.bg} style={{ width: `${occWidth}%` }} />
                      </div>
                      <span className={"w-12 text-right tabular-nums font-medium " + occ.color}>
                        {r.occupancyPct}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmt(r.grossRevenue)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-bad">{fmt(r.commission)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-good">{fmt(r.netPayout)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{r.adr ? fmt(r.adr) : <span className="text-faint">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-panel2/40 text-sm font-semibold">
              <td className="px-4 py-3">Totals</td>
              <td className="px-4 py-3 text-muted">{sorted.length} properties</td>
              <td className="px-4 py-3 text-right tabular-nums">{totals.bookings}</td>
              <td className="px-4 py-3 text-right tabular-nums">{totals.occupiedNights}<span className="text-faint">/{totalDays}</span></td>
              <td className="px-4 py-3 text-right tabular-nums">{totalsOcc}%</td>
              <td className="px-4 py-3 text-right tabular-nums">{fmt(totals.grossRevenue)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-bad">{fmt(totals.commission)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-good">{fmt(totals.netPayout)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-muted">{totalsAdr ? fmt(totalsAdr) : "—"}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
