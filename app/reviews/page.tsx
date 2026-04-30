"use client";
import { useEffect, useMemo, useState } from "react";
import { TimelineFilter } from "@/components/TimelineFilter";
import { PropertyReviewsTable, type PropertyReviewRow } from "@/components/PropertyReviewsTable";
import { ReviewCrm } from "@/components/ReviewCrm";
import { rangeForPreset, type DateRange } from "@/lib/datetime";
import type { Review, ReviewsResult } from "@/lib/reviews";
import type { CoverageBooking, CoverageResponse } from "@/app/api/review-coverage/route";
import type { CrmStore } from "@/lib/reviewCrm";

const REFRESH_MS = 5 * 60 * 1000;

type ChannelKey = "all" | "airbnb" | "booking" | "vrbo" | "guesty-direct" | "other";
type RatingKey = "all" | "5" | "4" | "3" | "<=2";

export default function ReviewsPage() {
  const [data, setData] = useState<ReviewsResult | null>(null);
  const [coverage, setCoverage] = useState<CoverageResponse | null>(null);
  const [crm, setCrm] = useState<CrmStore>({});
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [channel, setChannel] = useState<ChannelKey>("all");
  const [rating, setRating] = useState<RatingKey>("all");
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<DateRange>(() => rangeForPreset("all-time"));

  async function load() {
    setRefreshing(true);
    try {
      const [reviewsRes, coverageRes, crmRes] = await Promise.all([
        fetch("/api/reviews", { cache: "no-store" }),
        fetch("/api/review-coverage", { cache: "no-store" }),
        fetch("/api/review-crm", { cache: "no-store" }),
      ]);
      if (!reviewsRes.ok) throw new Error(`Reviews request failed: ${reviewsRes.status}`);
      setData(await reviewsRes.json());
      if (coverageRes.ok) setCoverage(await coverageRes.json());
      if (crmRes.ok) setCrm(await crmRes.json());
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

  // Apply date range first; everything downstream (KPIs, distribution, list,
  // per-property table) shares this same filtered set.
  const inRange = useMemo(() => {
    if (!data) return [];
    return data.reviews.filter((r) => {
      if (!r.createdAt) return false;
      const d = r.createdAt.slice(0, 10);
      return d >= range.start && d <= range.end;
    });
  }, [data, range]);

  const stats = useMemo(() => {
    const reviews = inRange.filter((r) => r.rating !== null);
    const total = reviews.length;
    const avg = total ? reviews.reduce((s, r) => s + (r.rating ?? 0), 0) / total : 0;
    const distribution = [5, 4, 3, 2, 1].map((star) => {
      const count = reviews.filter((r) => Math.round(r.rating!) === star).length;
      return { star, count, pct: total ? Math.round((count / total) * 100) : 0 };
    });
    const positive = reviews.filter((r) => (r.rating ?? 0) >= 4).length;
    const positivePct = total ? Math.round((positive / total) * 100) : 0;
    const channels = new Map<string, { count: number; sum: number }>();
    for (const r of reviews) {
      const k = r.channelLabel;
      const prev = channels.get(k) ?? { count: 0, sum: 0 };
      prev.count += 1;
      prev.sum += r.rating ?? 0;
      channels.set(k, prev);
    }
    const channelStats = [...channels.entries()].map(([label, v]) => ({
      label,
      count: v.count,
      avg: v.count ? v.sum / v.count : 0,
    })).sort((a, b) => b.count - a.count);
    return { total, avg, distribution, positivePct, channelStats };
  }, [inRange]);

  const propertyRows = useMemo<PropertyReviewRow[]>(() => {
    if (inRange.length === 0) return [];
    const map = new Map<string, {
      propertyName: string;
      count: number;
      sumRating: number;
      withRating: number;
      positive: number;
      negative: number;
      latestDate: string;
      channels: Map<string, number>;
    }>();
    // Property breakdown only counts reviews from listings that still exist
    // in Guesty (have a known name). Reviews from fully-deleted properties
    // are surfaced separately in `removedListingsCount` below.
    for (const r of inRange) {
      if (!r.propertyName || !r.listingId) continue;
      const prev = map.get(r.listingId) ?? {
        propertyName: r.propertyName,
        count: 0, sumRating: 0, withRating: 0,
        positive: 0, negative: 0, latestDate: "",
        channels: new Map(),
      };
      prev.count += 1;
      if (r.rating !== null) {
        prev.sumRating += r.rating;
        prev.withRating += 1;
        if (r.rating >= 4) prev.positive += 1;
        if (r.rating <= 2) prev.negative += 1;
      }
      if (r.createdAt > prev.latestDate) prev.latestDate = r.createdAt;
      prev.channels.set(r.channelLabel, (prev.channels.get(r.channelLabel) ?? 0) + 1);
      map.set(r.listingId, prev);
    }
    return [...map.entries()]
      .map(([propertyId, v]) => {
        let topChannel = "—"; let topCount = 0;
        for (const [ch, n] of v.channels) {
          if (n > topCount) { topChannel = ch; topCount = n; }
        }
        return {
          propertyId,
          propertyName: v.propertyName,
          count: v.count,
          avgRating: v.withRating > 0 ? v.sumRating / v.withRating : 0,
          withRating: v.withRating,
          positive: v.positive,
          negative: v.negative,
          latestDate: v.latestDate,
          topChannel,
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [inRange]);

  // Reviews referencing listings that no longer exist in Guesty (deleted).
  // We still count them in the global KPIs, just not in the per-property table.
  const removedListingsCount = useMemo(
    () => inRange.filter((r) => !r.propertyName).length,
    [inRange]
  );

  // Checkout coverage: completed stays in the date range and what % left a review.
  const coverageStats = useMemo(() => {
    if (!coverage) return { total: 0, withReview: 0, awaiting: 0, pct: 0 };
    const inRangeBookings = coverage.bookings.filter(
      b => b.checkOut >= range.start && b.checkOut <= range.end
    );
    const total      = inRangeBookings.length;
    const withReview = inRangeBookings.filter(b => b.hasReview).length;
    return {
      total,
      withReview,
      awaiting: total - withReview,
      pct: total ? Math.round((withReview / total) * 1000) / 10 : 0,
    };
  }, [coverage, range]);

  const filtered = useMemo(() => {
    return inRange.filter((r) => {
      if (channel !== "all" && r.channel !== channel) return false;
      if (rating !== "all") {
        if (r.rating === null) return false;
        const rounded = Math.round(r.rating);
        if (rating === "5"   && rounded !== 5) return false;
        if (rating === "4"   && rounded !== 4) return false;
        if (rating === "3"   && rounded !== 3) return false;
        if (rating === "<=2" && rounded > 2)   return false;
      }
      if (query.trim()) {
        const q = query.toLowerCase();
        const hay = [r.publicReview, r.propertyName ?? "", r.reservationCode, r.channelLabel].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [inRange, channel, rating, query]);

  if (error) {
    return (
      <main className="mx-auto max-w-7xl p-8">
        <div className="rounded-xl border border-bad/40 bg-bad/5 p-5 text-bad">
          Failed to load reviews: {error}
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

  return (
    <main className="mx-auto max-w-7xl space-y-10 px-6 py-10 animate-fade-in">
      {/* Hero */}
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
            Guest Reviews
          </p>
          <h1 className="mt-2 text-display-lg tracking-tight text-text">
            {stats.total.toLocaleString()} reviews <span className="text-faint">·</span>{" "}
            <span className="tabular-nums">{stats.avg.toFixed(2)}</span>
            <span className="text-muted"> / 5</span>
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            Channel reviews via Guesty · auto-refresh 5 min ·{" "}
            <span className="text-text">{new Date(data.generatedAt).toLocaleTimeString()}</span>
            {data.cacheStatus === "stale" && (
              <span className="ml-2 rounded-full border border-warn/40 bg-warn/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-warn">
                stale (Guesty rate-limited)
              </span>
            )}
          </p>
        </div>
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
      </section>

      {/* Date filter */}
      <TimelineFilter
        value={range}
        onChange={setRange}
        presets={["all-time", "this-month", "last-month", "last-30", "last-90", "this-week"]}
      />

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi label="Average Rating" value={stats.avg.toFixed(2)} sub="out of 5.00" tone="accent" />
        <Kpi label="Total Reviews"  value={stats.total.toLocaleString()} sub={range.label.toLowerCase()} />
        <Kpi label="Positive (4+ ★)" value={`${stats.positivePct}%`} sub="of all reviews" tone={stats.positivePct >= 80 ? "good" : "default"} />
        <Kpi
          label="Top Channel"
          value={stats.channelStats[0]?.label ?? "—"}
          sub={stats.channelStats[0]
            ? `${stats.channelStats[0].count} reviews · ${stats.channelStats[0].avg.toFixed(2)} avg`
            : ""}
        />
      </section>

      {/* Distribution + per-channel split */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-panel p-6 shadow-soft">
          <h2 className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
            Rating distribution
          </h2>
          <div className="space-y-3">
            {stats.distribution.map((d) => {
              const w = Math.max(2, d.pct);
              const tone = d.star >= 4 ? "bg-good" : d.star === 3 ? "bg-accent" : "bg-bad";
              return (
                <div key={d.star} className="flex items-center gap-3 text-sm">
                  <div className="w-12 text-muted">{d.star} ★</div>
                  <div className="flex-1 overflow-hidden rounded-full bg-panel3">
                    <div className={"h-2 rounded-full " + tone} style={{ width: `${w}%` }} />
                  </div>
                  <div className="w-12 text-right tabular-nums text-text">{d.count}</div>
                  <div className="w-10 text-right tabular-nums text-muted">{d.pct}%</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-panel p-6 shadow-soft">
          <h2 className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
            By channel
          </h2>
          <div className="space-y-3">
            {stats.channelStats.length === 0 ? (
              <p className="text-sm text-faint">No reviews in selected range.</p>
            ) : (
              stats.channelStats.map((c) => (
                <div key={c.label} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-text">{c.label}</span>
                    <span className="rounded-full bg-panel2 px-2 py-0.5 text-[11px] text-muted">
                      {c.count} reviews
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Stars rating={c.avg} size="sm" />
                    <span className="tabular-nums text-text">{c.avg.toFixed(2)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Per-property breakdown */}
      <div className="space-y-2">
        <PropertyReviewsTable
          data={propertyRows}
          rangeLabel={`${range.label} · ${range.start} → ${range.end}`}
        />
        {removedListingsCount > 0 && (
          <p className="px-1 text-[11px] text-faint">
            {removedListingsCount.toLocaleString()} review{removedListingsCount === 1 ? "" : "s"} from listings
            that no longer exist in Guesty (deleted properties) are counted in the KPIs above and the review list,
            but excluded from the per-property table.
          </p>
        )}
      </div>

      {/* Checkout coverage — total checkouts vs reviews received */}
      {coverage && (
        <section className="rounded-2xl border border-border bg-panel p-5 sm:p-6 shadow-soft">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
              Checkout Coverage · {range.label}
            </h2>
            <span className="text-[11px] text-faint">
              Confirmed stays that have already checked out · {range.start} → {range.end}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <CoverageStat
              label="Total Checkouts"
              value={coverageStats.total.toLocaleString()}
              tone="accent"
            />
            <CoverageStat
              label="Reviews Received"
              value={coverageStats.withReview.toLocaleString()}
              sub={`${coverageStats.pct}% coverage`}
              tone="good"
            />
            <CoverageStat
              label="Awaiting Review"
              value={coverageStats.awaiting.toLocaleString()}
              sub={coverageStats.total ? `${(100 - coverageStats.pct).toFixed(1)}% open` : ""}
              tone={coverageStats.awaiting > 0 ? "warn" : "good"}
            />
          </div>

          {/* Progress bar */}
          {coverageStats.total > 0 && (
            <div className="mt-5">
              <div className="mb-1.5 flex justify-between text-[10px] uppercase tracking-wider">
                <span className="text-faint">Coverage rate</span>
                <span className={`tabular-nums font-bold ${
                  coverageStats.pct >= 80 ? "text-good" :
                  coverageStats.pct >= 50 ? "text-warn" : "text-bad"
                }`}>
                  {coverageStats.withReview} / {coverageStats.total} · {coverageStats.pct}%
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-panel3">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    coverageStats.pct >= 80 ? "bg-good" :
                    coverageStats.pct >= 50 ? "bg-warn" : "bg-bad"
                  }`}
                  style={{ width: `${coverageStats.pct}%` }}
                />
              </div>
            </div>
          )}
        </section>
      )}

      {/* Review CRM */}
      {coverage && (
        <ReviewCrm bookings={coverage.bookings} initialCrm={crm} />
      )}

      {/* List filters */}
      <section className="rounded-xl border border-border bg-panel p-3 shadow-soft">
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">Channel</span>
          <Segmented
            options={[
              { v: "all", label: "All" },
              { v: "airbnb", label: "Airbnb" },
              { v: "booking", label: "Booking" },
              { v: "vrbo", label: "Vrbo" },
              { v: "guesty-direct", label: "Direct" },
              { v: "other", label: "Other" },
            ]}
            value={channel}
            onChange={(v) => setChannel(v as ChannelKey)}
          />
          <span className="mx-1 h-5 w-px bg-border" />
          <span className="px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">Rating</span>
          <Segmented
            options={[
              { v: "all", label: "All" },
              { v: "5", label: "5 ★" },
              { v: "4", label: "4 ★" },
              { v: "3", label: "3 ★" },
              { v: "<=2", label: "≤ 2 ★" },
            ]}
            value={rating}
            onChange={(v) => setRating(v as RatingKey)}
          />
          <div className="relative ml-auto">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search reviews, properties, codes…"
              className="w-72 rounded-lg border border-border bg-panel2 py-2 pl-9 pr-3 text-xs text-text placeholder:text-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40"
            />
            <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </div>
        </div>
      </section>

      {/* List */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
            {filtered.length} review{filtered.length === 1 ? "" : "s"}
          </h2>
          <span className="text-[11px] text-muted">most recent first</span>
        </div>
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-panel/50 p-10 text-center text-sm text-muted">
            No reviews match the current filters.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => <ReviewCard key={r.id} r={r} />)}
          </div>
        )}
      </section>
    </main>
  );
}

function ReviewCard({ r }: { r: Review }) {
  const date = r.createdAt
    ? new Date(r.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "—";
  return (
    <article className="rounded-xl border border-border bg-panel p-5 shadow-soft transition-colors hover:border-borderStrong">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-3">
          <Stars rating={r.rating ?? 0} />
          {r.rating !== null && (
            <span className="rounded-full bg-panel2 px-2 py-0.5 tabular-nums text-text">
              {r.rating.toFixed(1)}
            </span>
          )}
          <ChannelPill label={r.channelLabel} />
          {r.hidden && (
            <span className="rounded-full border border-warn/40 bg-warn/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-warn">
              hidden
            </span>
          )}
        </div>
        <div className="text-muted">
          {r.propertyName ? (
            <span className="text-text">{r.propertyName}</span>
          ) : (
            <span className="italic text-faint">Listing removed</span>
          )}
          <span className="mx-1.5 text-faint">·</span>
          {r.reservationCode && <span className="font-mono">{r.reservationCode}</span>}
          {r.reservationCode && <span className="mx-1.5 text-faint">·</span>}
          <span>{date}</span>
        </div>
      </div>

      {r.publicReview ? (
        <p className="whitespace-pre-line text-sm leading-relaxed text-text">{r.publicReview}</p>
      ) : (
        <p className="text-sm italic text-faint">No public comment.</p>
      )}

      {r.categories.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {r.categories.map((c) => (
            <span key={c.category} className="rounded-md bg-panel2 px-2 py-0.5 text-[11px] text-muted">
              {c.category}: <span className="text-text">{c.rating}</span>
            </span>
          ))}
        </div>
      )}

      {r.hostReply && (
        <div className="mt-4 rounded-lg border border-accent/30 bg-accent/5 p-3 text-sm">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-accent">
            Host reply
          </div>
          <p className="whitespace-pre-line text-text">{r.hostReply}</p>
        </div>
      )}
    </article>
  );
}

function Stars({ rating, size = "md" }: { rating: number; size?: "sm" | "md" }) {
  const filled = Math.round(rating);
  const cls = size === "sm" ? "text-sm" : "text-base";
  return (
    <span className={"tracking-wider " + cls}>
      <span className="text-warn">{"★".repeat(filled)}</span>
      <span className="text-borderStrong">{"★".repeat(5 - filled)}</span>
    </span>
  );
}

function ChannelPill({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-border bg-panel2 px-2 py-0.5 text-[11px] text-muted">
      {label}
    </span>
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
    <div className="inline-flex rounded-lg border border-border bg-panel2/60 p-1">
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

function CoverageStat({
  label, value, sub, tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "default" | "good" | "warn" | "accent";
}) {
  const valCls  = tone === "good" ? "text-good" : tone === "warn" ? "text-warn" : tone === "accent" ? "text-accent" : "text-text";
  const accent  = tone === "good" ? "bg-good"   : tone === "warn" ? "bg-warn"   : tone === "accent" ? "bg-accent"   : "bg-borderStrong";
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-panel2/40 p-3 sm:p-4">
      <div className={`absolute inset-x-0 top-0 h-px opacity-60 ${accent}`} />
      <div className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className={`mt-1.5 text-xl sm:text-2xl tabular-nums font-bold ${valCls}`}>{value}</div>
      {sub && <div className="mt-1 text-[10px] sm:text-[11px] text-muted">{sub}</div>}
    </div>
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
