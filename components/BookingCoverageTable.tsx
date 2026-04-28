"use client";
import { useMemo, useState } from "react";
import type { CoverageBooking } from "@/app/api/review-coverage/route";

const CHANNEL_LABELS: Record<string, string> = {
  airbnb: "Airbnb",
  booking: "Booking.com",
  vrbo: "Vrbo",
  "guesty-direct": "Direct",
  other: "Other",
};

type StatusKey = "all" | "with" | "without";

function fmtDate(iso: string): string {
  if (!iso) return "—";
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  });
}

interface Props {
  bookings: CoverageBooking[];
  rangeLabel: string;
}

export function BookingCoverageTable({ bookings, rangeLabel }: Props) {
  const [status, setStatus] = useState<StatusKey>("all");
  const [channel, setChannel] = useState<string>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      if (status === "with"    && !b.hasReview) return false;
      if (status === "without" &&  b.hasReview) return false;
      if (channel !== "all" && b.channel !== channel) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        const hay = [b.confirmationCode, b.propertyName, CHANNEL_LABELS[b.channel] ?? b.channel].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [bookings, status, channel, query]);

  const totals = useMemo(() => {
    const total = bookings.length;
    const withR = bookings.filter((b) => b.hasReview).length;
    return {
      total,
      withReview: withR,
      withoutReview: total - withR,
      coveragePct: total ? Math.round((withR / total) * 1000) / 10 : 0,
    };
  }, [bookings]);

  const channels = useMemo(() => {
    const set = new Set<string>();
    bookings.forEach((b) => set.add(b.channel));
    return [...set];
  }, [bookings]);

  return (
    <section className="space-y-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
          Review Coverage
        </p>
        <h2 className="mt-1 text-base font-semibold tracking-tight text-text">
          {totals.total.toLocaleString()} completed bookings · {totals.coveragePct}% have a review
        </h2>
        <p className="mt-0.5 text-[11px] text-muted">
          {rangeLabel} · only stays whose checkout date has passed are counted (eligible for review)
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi label="Eligible bookings" value={totals.total.toLocaleString()} sub="checked out" />
        <Kpi label="With review" value={totals.withReview.toLocaleString()}
             sub={`${totals.total ? Math.round((totals.withReview/totals.total)*100) : 0}% of total`}
             tone="good" />
        <Kpi label="Missing review" value={totals.withoutReview.toLocaleString()}
             sub={`${totals.total ? Math.round((totals.withoutReview/totals.total)*100) : 0}% of total`}
             tone={totals.withoutReview > 0 ? "bad" : "default"} />
        <Kpi label="Coverage rate" value={`${totals.coveragePct}%`}
             sub={totals.coveragePct >= 50 ? "above hospitality avg" : "below hospitality avg"}
             tone="accent" />
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-border bg-panel p-3 shadow-soft">
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">Status</span>
          <Segmented
            options={[
              { v: "all",     label: "All" },
              { v: "without", label: "Missing review" },
              { v: "with",    label: "Reviewed" },
            ]}
            value={status}
            onChange={(v) => setStatus(v as StatusKey)}
          />
          <span className="mx-1 h-5 w-px bg-border" />
          <span className="px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">Channel</span>
          <Segmented
            options={[
              { v: "all", label: "All" },
              ...channels.map((c) => ({ v: c, label: CHANNEL_LABELS[c] ?? c })),
            ]}
            value={channel}
            onChange={setChannel}
          />
          <div className="relative ml-auto">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search code, property, channel…"
              className="w-72 rounded-lg border border-border bg-panel2 py-2 pl-9 pr-3 text-xs text-text placeholder:text-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40"
            />
            <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-panel shadow-soft">
        <div className="flex items-center justify-between px-6 py-3 text-[11px] text-muted">
          <span>{filtered.length.toLocaleString()} of {totals.total.toLocaleString()} bookings</span>
        </div>
        <div className="overflow-auto border-t border-border/60 max-h-[640px]">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="sticky top-0 z-10 bg-panel/95 backdrop-blur">
              <tr className="text-[11px] uppercase tracking-wider text-faint">
                <th className="border-b border-border px-4 py-3 text-left  font-medium">Channel</th>
                <th className="border-b border-border px-4 py-3 text-left  font-medium">Property</th>
                <th className="border-b border-border px-4 py-3 text-left  font-medium">Booking ID</th>
                <th className="border-b border-border px-4 py-3 text-right font-medium">Check-in</th>
                <th className="border-b border-border px-4 py-3 text-right font-medium">Check-out</th>
                <th className="border-b border-border px-4 py-3 text-center font-medium">Reviewed</th>
                <th className="border-b border-border px-4 py-3 text-right font-medium">Rating</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">
                    No bookings match the current filters.
                  </td>
                </tr>
              ) : filtered.map((b) => (
                <tr key={b.id} className="border-t border-border/40 transition-colors hover:bg-panel2/40">
                  <td className="px-4 py-2.5">
                    <span className="rounded-full border border-border bg-panel2 px-2 py-0.5 text-[11px] text-muted">
                      {CHANNEL_LABELS[b.channel] ?? b.channel}
                    </span>
                  </td>
                  <td className="max-w-[260px] truncate px-4 py-2.5 text-text">{b.propertyName}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted">{b.confirmationCode}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted">{fmtDate(b.checkIn)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted">{fmtDate(b.checkOut)}</td>
                  <td className="px-4 py-2.5 text-center">
                    {b.hasReview ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-good/30 bg-good/5 px-2 py-0.5 text-[11px] font-medium text-good">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Yes
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-bad/30 bg-bad/5 px-2 py-0.5 text-[11px] font-medium text-bad">
                        No
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {b.reviewRating !== null ? (
                      <span className="inline-flex items-center gap-1.5 tabular-nums">
                        <span className="text-warn">★</span>
                        <span className="text-text">{b.reviewRating.toFixed(1)}</span>
                      </span>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
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
    tone === "good"   ? "bg-good"
    : tone === "bad"  ? "bg-bad"
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

function Segmented({
  options, value, onChange,
}: {
  options: { v: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex flex-wrap rounded-lg border border-border bg-panel2/60 p-1">
      {options.map((o) => {
        const active = o.v === value;
        return (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            className={
              "rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 " +
              (active ? "bg-accent text-white shadow-soft" : "text-muted hover:text-text")
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
