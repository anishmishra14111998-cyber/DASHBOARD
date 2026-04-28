import { Redis } from "@upstash/redis";
import { fetchGuestyToken } from "./guestyToken";
import type { Channel } from "./types";

const REVIEWS_URL = "https://open-api.guesty.com/v1/reviews";

// Reuse the Upstash KV that already backs the Guesty token cache.
const redis = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
  ? new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    })
  : null;
const CACHE_KEY = "guesty:reviews:v1";
const CACHE_TTL_SECONDS = 600;     // 10 min — tradeoff between freshness and hitting Guesty's rate limit
const STALE_TTL_SECONDS = 86400;   // keep around for 24h as a fallback when Guesty rate-limits us

export interface Review {
  id: string;
  reservationId: string;          // Guesty internal — used to join with reservations
  channel: Channel;
  channelLabel: string;
  externalReviewId: string;
  listingId: string;
  externalListingId: string;
  propertyName?: string;
  reservationCode: string;
  guestId: string;
  createdAt: string;          // ISO
  rating: number | null;      // overall, 1..5
  publicReview: string;
  privateReview: string;
  reviewerRole: "guest" | "host" | "unknown";
  hidden: boolean;
  submitted: boolean;
  categories: { category: string; rating: number }[];
  hostReply: string;
}

interface RawReview {
  _id: string;
  channelId?: string;
  externalReviewId?: string;
  listingId?: string;
  externalListingId?: string;
  externalReservationId?: string;
  reservationId?: string;
  guestId?: string;
  createdAt?: string;
  // `rawReview` shape varies wildly by channel — keep it as `unknown` and coerce at read time.
  rawReview?: Record<string, unknown>;
  reviewReplies?: { content?: unknown; text?: unknown }[];
}

// Safely coerce any channel field into a trimmed string. Channels send
// strings, objects, arrays of strings, or null depending on the field — all
// rolled up here so `.trim()` etc. never explode at runtime.
function asString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(asString).filter(Boolean).join(" ").trim();
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    // Common nested shapes from Booking.com / Vrbo
    if (typeof o.text === "string")    return o.text.trim();
    if (typeof o.value === "string")   return o.value.trim();
    if (typeof o.content === "string") return o.content.trim();
    return "";
  }
  return "";
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

function detectChannel(channelId: string): Channel {
  const c = (channelId || "").toLowerCase();
  if (c.includes("airbnb")) return "airbnb";
  if (c.includes("booking")) return "booking";
  if (c.includes("homeaway") || c.includes("vrbo") || c.includes("expedia")) return "vrbo";
  if (c.includes("direct"))  return "guesty-direct";
  return "other";
}

const CHANNEL_LABEL: Record<Channel, string> = {
  airbnb: "Airbnb",
  booking: "Booking.com",
  vrbo: "Vrbo",
  "guesty-direct": "Direct",
  other: "Other",
};

interface Extracted {
  rating: number | null;
  publicReview: string;
  privateReview: string;
  reservationCode: string;
  categories: { category: string; rating: number }[];
  hostReply: string;
}

// ---- Channel-specific extractors. Each channel ships totally different
// field names through `rawReview`, so we branch on detectChannel() output.

function extractAirbnb(raw: Record<string, unknown>): Extracted {
  const cats = Array.isArray(raw.category_ratings) ? (raw.category_ratings as unknown[]) : [];
  return {
    rating: asNumber(raw.overall_rating),
    publicReview: asString(raw.public_review),
    privateReview: asString(raw.private_feedback),
    reservationCode: asString(raw.reservation_confirmation_code),
    categories: cats
      .map((c) => {
        if (!c || typeof c !== "object") return null;
        const o = c as Record<string, unknown>;
        const cat = asString(o.category);
        const rt = asNumber(o.rating);
        if (!cat || rt === null) return null;
        return { category: cat, rating: rt };
      })
      .filter((x): x is { category: string; rating: number } => x !== null),
    hostReply: "",
  };
}

function extractBooking(raw: Record<string, unknown>): Extracted {
  const scoring = (raw.scoring ?? {}) as Record<string, unknown>;
  const score10 = asNumber(scoring.review_score);
  // Booking.com scores 1-10 — convert to 1-5 to match the rest of the dashboard.
  const rating = score10 !== null ? Math.round((score10 / 2) * 10) / 10 : null;

  const content = (raw.content ?? {}) as Record<string, unknown>;
  const headline = asString(content.headline);
  const positive = asString(content.positive);
  const negative = asString(content.negative);
  const isFiller = (s: string) => !s || /^\s*(na|n\/a|none|nothing)\s*$/i.test(s);
  const parts: string[] = [];
  if (headline) parts.push(headline);
  if (!isFiller(positive)) parts.push(`Liked: ${positive}`);
  if (!isFiller(negative)) parts.push(`Disliked: ${negative}`);
  const publicReview = parts.join(" — ");

  const catFields = ["facilities", "comfort", "staff", "value", "clean", "location"];
  const categories = catFields
    .map((k) => {
      const rt = asNumber(scoring[k]);
      return rt !== null ? { category: k, rating: Math.round((rt / 2) * 10) / 10 } : null;
    })
    .filter((x): x is { category: string; rating: number } => x !== null);

  let hostReply = "";
  if (raw.reply && typeof raw.reply === "object") {
    const o = raw.reply as Record<string, unknown>;
    hostReply = asString(o.text) || asString(o.content) || asString(o.body) || asString(o.value);
  }

  return {
    rating,
    publicReview,
    privateReview: "",
    reservationCode: asString(raw.reservation_id),
    categories,
    hostReply,
  };
}

function extractVrbo(raw: Record<string, unknown>): Extracted {
  const body = (raw.body ?? {}) as Record<string, unknown>;
  const title = (raw.title ?? {}) as Record<string, unknown>;
  const publicReview = asString(body.value) || asString(title.value);

  const reservation = (raw.reservation ?? {}) as Record<string, unknown>;
  const ids = Array.isArray(reservation.reservationIds) ? (reservation.reservationIds as unknown[]) : [];
  let reservationCode = "";
  for (const id of ids) {
    if (!id || typeof id !== "object") continue;
    const o = id as Record<string, unknown>;
    if (asString(o.idSource).toUpperCase() === "SUPPLIER") {
      reservationCode = asString(o.id);
      break;
    }
  }
  if (!reservationCode && ids.length > 0) {
    reservationCode = asString((ids[0] as Record<string, unknown>)?.id);
  }

  const stars = Array.isArray(raw.starRatings) ? (raw.starRatings as unknown[]) : [];
  const categories = stars
    .map((s) => {
      if (!s || typeof s !== "object") return null;
      const o = s as Record<string, unknown>;
      const cat = asString(o.category);
      const rt = asNumber(o.value);
      if (!cat || rt === null || cat.toLowerCase() === "overall") return null;
      return { category: cat, rating: rt };
    })
    .filter((x): x is { category: string; rating: number } => x !== null);

  let hostReply = "";
  if (raw.response && typeof raw.response === "object") {
    const o = raw.response as Record<string, unknown>;
    hostReply = asString(o.body) || asString(o.text) || asString(o.content);
  }

  return {
    rating: asNumber(raw.starRatingOverall),
    publicReview,
    privateReview: "",
    reservationCode,
    categories,
    hostReply,
  };
}

function mapReview(r: RawReview, listingNames: Map<string, string>): Review {
  const channel = detectChannel(r.channelId ?? "");
  const raw = (r.rawReview ?? {}) as Record<string, unknown>;

  const ext: Extracted =
      channel === "airbnb"  ? extractAirbnb(raw)
    : channel === "booking" ? extractBooking(raw)
    : channel === "vrbo"    ? extractVrbo(raw)
    : extractAirbnb(raw);  // best-effort fallback for unknown channels

  // Top-level reviewReplies (Airbnb-style) augments any channel-specific reply we extracted.
  const repliesAtTopLevel = (r.reviewReplies ?? [])
    .map((re) => asString(re?.content) || asString(re?.text))
    .filter(Boolean)
    .join(" — ");
  const hostReply = ext.hostReply || repliesAtTopLevel;

  const role = asString(raw.reviewer_role).toLowerCase();
  const reviewerRole: Review["reviewerRole"] =
    role === "guest" ? "guest" : role === "host" ? "host" : "unknown";

  return {
    id: r._id,
    reservationId: r.reservationId ?? "",
    channel,
    channelLabel: CHANNEL_LABEL[channel],
    externalReviewId: r.externalReviewId ?? "",
    listingId: r.listingId ?? "",
    externalListingId: r.externalListingId ?? "",
    propertyName: r.listingId ? listingNames.get(r.listingId) : undefined,
    reservationCode: ext.reservationCode || (r.externalReservationId ?? ""),
    guestId: r.guestId ?? "",
    createdAt: r.createdAt ?? "",
    rating: ext.rating,
    publicReview: ext.publicReview,
    privateReview: ext.privateReview,
    reviewerRole,
    // Booking and Vrbo don't carry these flags — treat as visible/submitted.
    hidden: raw.hidden === true,
    submitted: channel === "airbnb" ? raw.submitted === true : true,
    categories: ext.categories,
    hostReply,
  };
}

async function fetchPage(token: string, skip: number, limit: number): Promise<RawReview[]> {
  const url = new URL(REVIEWS_URL);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("skip",  String(skip));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Reviews fetch failed: ${res.status} — ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { data?: RawReview[]; results?: RawReview[] };
  return json.data ?? json.results ?? [];
}

export interface ReviewsResult {
  generatedAt: string;
  reviews: Review[];
  totalRaw: number;       // total returned by Guesty (incl. hidden / not-submitted / placeholders)
  visible: number;        // number passing our display filter
  cacheStatus: "fresh" | "cached" | "stale";  // for debugging in the UI
}

interface CachedPayload {
  generatedAt: string;
  reviews: Review[];
  totalRaw: number;
  visible: number;
  cachedAt: number;        // epoch ms
}

async function readCache(): Promise<CachedPayload | null> {
  if (!redis) return null;
  try {
    const v = await redis.get<CachedPayload>(CACHE_KEY);
    return v ?? null;
  } catch {
    return null;
  }
}

async function writeCache(p: CachedPayload) {
  if (!redis) return;
  try {
    // Keep the value alive for STALE_TTL so we have a fallback when rate-limited;
    // freshness is enforced separately by checking `cachedAt`.
    await redis.set(CACHE_KEY, p, { ex: STALE_TTL_SECONDS });
  } catch { /* ignore */ }
}

export async function fetchReviews(listingNames: Map<string, string>): Promise<ReviewsResult> {
  // 1. Serve fresh from cache when within TTL.
  const cached = await readCache();
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_SECONDS * 1000) {
    return {
      generatedAt: cached.generatedAt,
      reviews: cached.reviews,
      totalRaw: cached.totalRaw,
      visible: cached.visible,
      cacheStatus: "cached",
    };
  }

  // 2. Otherwise refetch — and on Guesty rate-limit, fall back to stale cache.
  try {
    const token = await fetchGuestyToken();
    const limit = 100;
    const all: RawReview[] = [];
    for (let page = 0; page < 25; page++) {
      const batch = await fetchPage(token, page * limit, limit);
      all.push(...batch);
      if (batch.length < limit) break;
    }

    const reviews = all
      .map((r) => mapReview(r, listingNames))
      .filter((r) => r.publicReview || r.rating !== null)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    const fresh: CachedPayload = {
      generatedAt: new Date().toISOString(),
      reviews,
      totalRaw: all.length,
      visible: reviews.length,
      cachedAt: Date.now(),
    };
    await writeCache(fresh);
    return { ...fresh, cacheStatus: "fresh" };
  } catch (err) {
    if (cached) {
      // Stale-while-rate-limited fallback — much better UX than a 500.
      return {
        generatedAt: cached.generatedAt,
        reviews: cached.reviews,
        totalRaw: cached.totalRaw,
        visible: cached.visible,
        cacheStatus: "stale",
      };
    }
    throw err;
  }
}
