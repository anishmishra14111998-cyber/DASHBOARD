import { promises as fs } from "fs";
import path from "path";
import { Redis } from "@upstash/redis";
import type { Property, Reservation, SourceStatus } from "./types";
import { generateReservations, properties as mockProperties } from "./mockData";

// Upstash Redis client — only used when KV_REST_API_URL/TOKEN are set.
// Vercel auto-injects these via the Upstash marketplace integration.
const redis = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
  ? new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    })
  : null;
const REDIS_TOKEN_KEY = "guesty:access-token";

const TOKEN_URL = "https://open-api.guesty.com/oauth2/token";
const RESERVATIONS_URL = "https://open-api.guesty.com/v1/reservations";
const LISTINGS_URL = "https://open-api.guesty.com/v1/listings";

const RESERVATION_FIELDS = [
  "_id", "status", "source", "confirmationCode",
  "integration.platform",
  "listingId", "listing.title", "listing.nickname",
  "checkIn", "checkOut", "nightsCount", "guestsCount",
  // Money — pulling everything we need for the three-basis MTD breakdown.
  "money.fareAccommodation",
  "money.fareAccommodationAdjusted",
  "money.fareCleaning",
  "money.fareCleaningAdjusted",
  "money.hostServiceFee",
  "money.hostServiceFeeIncTax",
  "money.totalTaxes",
  "money.processingFee",
  "money.subTotalPrice",
  "money.totalPrice",
  "money.netIncome",
  "money.hostPayout",
  "money.currency",
  // Line items — required to extract "Other Fees" (damage waivers, pet/resort fees, upsells).
  "money.invoiceItems",
].join(" ");

const LISTING_FIELDS = [
  "_id", "title", "nickname", "active",
  "address.city", "bedrooms",
].join(" ");

// On Vercel only `/tmp` is writable; locally use `.cache/` so it survives restarts.
const TOKEN_CACHE_PATH = process.env.VERCEL
  ? path.join("/tmp", "guesty-token.json")
  : path.join(process.cwd(), ".cache", "guesty-token.json");

interface CachedToken {
  token: string;
  expiresAt: number;
}

function hasRealCreds() {
  const id = process.env.GUESTY_CLIENT_ID;
  const secret = process.env.GUESTY_CLIENT_SECRET;
  return !!(id && secret && !id.startsWith("dummy") && !id.startsWith("your-"));
}

async function readDiskCache(): Promise<CachedToken | null> {
  try {
    const raw = await fs.readFile(TOKEN_CACHE_PATH, "utf8");
    const parsed = JSON.parse(raw) as CachedToken;
    if (parsed.expiresAt > Date.now()) return parsed;
    return null;
  } catch {
    return null;
  }
}

async function writeDiskCache(t: CachedToken) {
  await fs.mkdir(path.dirname(TOKEN_CACHE_PATH), { recursive: true });
  await fs.writeFile(TOKEN_CACHE_PATH, JSON.stringify(t), "utf8");
}

let memoryToken: CachedToken | null = null;

async function getAccessToken(): Promise<string> {
  // 1. Memory cache (fast path within a warm function instance)
  if (memoryToken && memoryToken.expiresAt > Date.now()) return memoryToken.token;

  // 2. Upstash Redis — primary persistent cache, survives Vercel cold starts.
  if (redis) {
    try {
      const stored = await redis.get<CachedToken>(REDIS_TOKEN_KEY);
      if (stored && stored.expiresAt > Date.now()) {
        memoryToken = stored;
        return stored.token;
      }
    } catch {
      // Redis hiccup — fall through to other caches.
    }
  }

  // 3. Bootstrap token from env vars (legacy fallback before Redis was set up).
  const bootstrapToken = process.env.GUESTY_BOOTSTRAP_TOKEN;
  const bootstrapExpStr = process.env.GUESTY_BOOTSTRAP_TOKEN_EXPIRES_AT;
  if (bootstrapToken && bootstrapExpStr) {
    const exp = Number(bootstrapExpStr);
    if (Number.isFinite(exp) && exp > Date.now()) {
      memoryToken = { token: bootstrapToken, expiresAt: exp };
      // Promote bootstrap into Redis so future cold starts skip env-var hop.
      if (redis) {
        try { await redis.set(REDIS_TOKEN_KEY, memoryToken); } catch { /* ignore */ }
      }
      return bootstrapToken;
    }
  }

  // 4. Disk cache (local dev, plus single-instance survival on Vercel via /tmp).
  const disk = await readDiskCache();
  if (disk) {
    memoryToken = disk;
    return disk.token;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: "open-api",
    client_id: process.env.GUESTY_CLIENT_ID!,
    client_secret: process.env.GUESTY_CLIENT_SECRET!,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after") ?? 0);
      const resetAt = new Date(Date.now() + retryAfter * 1000).toLocaleString();
      throw new Error(
        `Guesty token endpoint rate-limited (5/day). Resets at ~${resetAt}. Body: ${text}`
      );
    }
    throw new Error(`Guesty token request failed: ${res.status} — ${text}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  const t: CachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in - 300) * 1000,
  };
  memoryToken = t;
  // Persist to all available caches so subsequent cold starts skip the token endpoint.
  if (redis) {
    try { await redis.set(REDIS_TOKEN_KEY, t); } catch { /* ignore */ }
  }
  await writeDiskCache(t);
  return t.token;
}

async function authedGet(url: string, token: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${url} — ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function fetchAllReservations(token: string): Promise<GuestyReservation[]> {
  const all: GuestyReservation[] = [];
  const limit = 100;
  let skip = 0;
  // Without an explicit filter Guesty hides historical reservations. Pull
  // anything from the start of last year onward so MTD / daily numbers are real.
  const fromDate = `${new Date().getFullYear() - 1}-01-01`;
  const filters = JSON.stringify([
    { field: "checkIn", operator: "$gte", value: fromDate },
  ]);

  for (let page = 0; page < 50; page++) {
    const url = new URL(RESERVATIONS_URL);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("skip", String(skip));
    url.searchParams.set("fields", RESERVATION_FIELDS);
    url.searchParams.set("filters", filters);
    const json = (await authedGet(url.toString(), token)) as {
      results: GuestyReservation[];
      count: number;
    };
    const results = json.results ?? [];
    all.push(...results);
    if (results.length < limit || all.length >= json.count) break;
    skip += limit;
  }
  return all;
}

async function fetchAllListings(token: string): Promise<GuestyListing[]> {
  const all: GuestyListing[] = [];
  const limit = 100;
  let skip = 0;
  for (let page = 0; page < 20; page++) {
    const url = new URL(LISTINGS_URL);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("skip", String(skip));
    url.searchParams.set("fields", LISTING_FIELDS);
    url.searchParams.set("active", "true");
    const json = (await authedGet(url.toString(), token)) as {
      results: GuestyListing[];
      count: number;
    };
    const results = json.results ?? [];
    all.push(...results);
    if (results.length < limit || all.length >= json.count) break;
    skip += limit;
  }
  return all;
}

export interface GuestyResult {
  status: SourceStatus;
  reservations: Reservation[];
  properties: Property[];
}

export async function fetchGuesty(): Promise<GuestyResult> {
  if (!hasRealCreds()) {
    return {
      status: { connected: false, mode: "mock", message: "No Guesty credentials set — showing mock data." },
      reservations: generateReservations("guesty-direct", 11, 30),
      properties: mockProperties,
    };
  }

  try {
    const token = await getAccessToken();
    const [rawReservations, rawListings] = await Promise.all([
      fetchAllReservations(token),
      fetchAllListings(token),
    ]);
    const reservations = rawReservations.map(mapGuestyReservation);
    const properties = rawListings.map(mapGuestyListing);
    return {
      status: {
        connected: true,
        mode: "live",
        message: `Live Guesty data — ${reservations.length} reservations, ${properties.length} active listings`,
      },
      reservations,
      properties,
    };
  } catch (err) {
    return {
      status: {
        connected: false,
        mode: "mock",
        message: `Guesty error, showing mock: ${(err as Error).message}`,
      },
      reservations: generateReservations("guesty-direct", 11, 30),
      properties: mockProperties,
    };
  }
}

interface GuestyReservation {
  _id: string;
  source?: string;
  integration?: { platform?: string };
  listingId: string;
  listing?: { nickname?: string; title?: string };
  checkIn: string;
  checkOut: string;
  nightsCount?: number;
  guestsCount?: number;
  money?: {
    fareAccommodation?: number;
    fareAccommodationAdjusted?: number;
    fareCleaning?: number;
    fareCleaningAdjusted?: number;
    hostServiceFee?: number;
    hostServiceFeeIncTax?: number;
    totalTaxes?: number;
    processingFee?: number;
    subTotalPrice?: number;
    totalPrice?: number;
    netIncome?: number;
    hostPayout?: number;
    currency?: string;
    invoiceItems?: GuestyInvoiceItem[];
  };
  status?: string;
}

interface GuestyInvoiceItem {
  amount?: number;
  type?: string;        // e.g. ACCOMMODATION_FARE, CLEANING_FEE, MANUAL, TAX, …
  normalType?: string;  // short code: AF, CF, PCM, MAR, AFE, VT, LT, …
  title?: string;
  tags?: string[];
}

// Tax-like normalTypes — these are pass-through to authorities.
const TAX_TYPES = new Set([
  "VT",   // VAT
  "LT",   // Local tax
  "CT",   // City tax
  "TAX",
  "ST",   // State tax
  "TOT",  // Transient occupancy tax
  "GET",  // General excise tax
]);

// "Other fees" = anything that's not accommodation, cleaning, commission, or tax.
function classifyItem(it: GuestyInvoiceItem): "accom" | "cleaning" | "commission" | "tax" | "other" {
  const nt = (it.normalType ?? "").toUpperCase();
  const type = (it.type ?? "").toUpperCase();
  const tags = it.tags ?? [];

  if (tags.includes("part-of-af") || tags.includes("reservation-report-add-to-accommodation-fare"))
    return "accom";
  if (nt === "AF" || type === "ACCOMMODATION_FARE") return "accom";
  if (nt === "CF" || type === "CLEANING_FEE" || type === "CLEANING") return "cleaning";
  if (nt === "PCM" || nt === "HSF" || type === "HOST_CHANNEL_FEE" || type === "COMMISSION") return "commission";
  if (TAX_TYPES.has(nt) || type === "TAX" || type === "LOCAL_TAX") return "tax";
  return "other";
}

interface GuestyListing {
  _id: string;
  title?: string;
  nickname?: string;
  active?: boolean;
  address?: { city?: string };
  bedrooms?: number;
}

function detectChannel(r: GuestyReservation): Reservation["channel"] {
  const platform = (r.integration?.platform ?? "").toLowerCase();
  if (platform.startsWith("airbnb")) return "airbnb";
  if (platform.includes("booking")) return "booking";
  if (platform) return "other";
  const src = (r.source ?? "").toLowerCase();
  if (src.includes("airbnb")) return "airbnb";
  if (src.includes("booking")) return "booking";
  return "guesty-direct";
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
}

function mapGuestyReservation(r: GuestyReservation): Reservation {
  const m = r.money ?? {};
  const items = m.invoiceItems ?? [];

  // Walk invoiceItems to get a precise breakdown — this is the only place where
  // upsells / damage waivers / pet fees / resort fees show up.
  let accomFromItems = 0;
  let cleaningFromItems = 0;
  let otherFromItems = 0;
  let taxFromItems = 0;
  let commissionFromItems = 0;

  for (const it of items) {
    const amt = it.amount ?? 0;
    if (amt === 0) continue;
    switch (classifyItem(it)) {
      case "accom":      accomFromItems    += amt; break;
      case "cleaning":   cleaningFromItems += amt; break;
      case "tax":        taxFromItems      += amt; break;
      case "commission": commissionFromItems += Math.abs(amt); break; // stored as negative line item
      case "other":      otherFromItems    += amt; break;
    }
  }

  // Prefer the invoice-items breakdown when items are present; fall back to scalar fields.
  const netAccommodation = items.length ? accomFromItems    : (m.fareAccommodationAdjusted ?? m.fareAccommodation ?? 0);
  const cleaningFare     = items.length ? cleaningFromItems : (m.fareCleaningAdjusted ?? m.fareCleaning ?? 0);
  const taxes            = items.length ? taxFromItems      : (m.totalTaxes ?? 0);
  const otherFees        = items.length ? otherFromItems    : 0;
  const commission       = items.length && commissionFromItems > 0
    ? commissionFromItems
    : (m.hostServiceFee ?? 0);

  const grossRevenue = netAccommodation + cleaningFare + otherFees + taxes;
  const netPayout    = m.netIncome ?? m.hostPayout ?? m.subTotalPrice ?? (grossRevenue - commission - taxes);

  return {
    id: r._id,
    channel: detectChannel(r),
    propertyId: r.listingId,
    propertyName: r.listing?.nickname ?? r.listing?.title ?? r.listingId,
    checkIn: r.checkIn.slice(0, 10),
    checkOut: r.checkOut.slice(0, 10),
    nights: r.nightsCount ?? nightsBetween(r.checkIn, r.checkOut),
    guests: r.guestsCount ?? 1,

    netAccommodation,
    cleaningFare,
    otherFees,
    taxes,
    grossRevenue,
    channelCommission: commission,
    netPayout,
    currency: m.currency ?? "USD",

    status: r.status === "confirmed" ? "confirmed" : r.status === "canceled" ? "cancelled" : "pending",
  };
}

function mapGuestyListing(l: GuestyListing): Property {
  return {
    id: l._id,
    name: l.nickname ?? l.title ?? l._id,
    city: l.address?.city ?? "—",
    bedrooms: l.bedrooms ?? 0,
    nightlyBase: 0,
  };
}
