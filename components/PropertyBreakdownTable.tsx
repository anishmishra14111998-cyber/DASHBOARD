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

function occColor(pct: number, daysInRange: number): string {
  if (daysInRange === 0) return "text-muted";
  if (pct >= 75) return "text-good";
  if (pct >= 40) return "text-text";
  if (pct >  0)  return "text-bad";
  return "text-muted";
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

  // Totals row
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
    <div className="rounded-2xl border border-border bg-panel p-4 shadow-lg shadow-black/20">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
            Per-property breakdown
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            {rangeLabel} · {data.length} properties · click column headers to sort
          </p>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search property or city…"
          className="w-56 rounded-md border border-border bg-panel2 px-3 py-1.5 text-xs text-text placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40"
        />
      </div>

      <div className="overflow-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="sticky top-0 z-10 bg-panel2/95 backdrop-blur">
            <tr className="text-xs uppercase tracking-wider text-muted">
              {COLS.map((c) => {
                const active = c.key === sortKey;
                const arrow = active ? (sortDir === "asc" ? "▲" : "▼") : "";
                return (
                  <th
                    key={c.key}
                    onClick={() => clickHeader(c.key)}
                    className={
                      "cursor-pointer select-none border-b border-border px-3 py-2 font-medium transition-colors hover:text-text " +
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
            {sorted.map((r) => (
              <tr key={r.propertyId} className="border-t border-border/50 hover:bg-panel2/30">
                <td className="max-w-[280px] truncate px-3 py-1.5 text-text">{r.propertyName}</td>
                <td className="px-3 py-1.5 text-muted">{r.city}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{r.bookings || "—"}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-muted">
                  {r.occupiedNights} / {r.daysInRange}
                </td>
                <td className={"px-3 py-1.5 text-right tabular-nums font-medium " + occColor(r.occupancyPct, r.daysInRange)}>
                  {r.occupancyPct}%
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fmt(r.grossRevenue)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-bad">{fmt(r.commission)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums font-medium text-good">{fmt(r.netPayout)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-muted">{r.adr ? fmt(r.adr) : "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-panel2/40 text-sm font-semibold">
              <td className="px-3 py-2">Totals</td>
              <td className="px-3 py-2 text-muted">{sorted.length} properties</td>
              <td className="px-3 py-2 text-right tabular-nums">{totals.bookings}</td>
              <td className="px-3 py-2 text-right tabular-nums">{totals.occupiedNights} / {totalDays}</td>
              <td className="px-3 py-2 text-right tabular-nums">{totalsOcc}%</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmt(totals.grossRevenue)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-bad">{fmt(totals.commission)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-good">{fmt(totals.netPayout)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-muted">{totalsAdr ? fmt(totalsAdr) : "—"}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
