import { Redis } from "@upstash/redis";

const redis = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
  ? new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN })
  : null;

const CRM_KEY = "review-crm:v2";

export type NoReviewStatus = "pending" | "contacted" | "received";
export type SubStarStatus  = "pending" | "ask-change" | "dispute" | "resolved";

export interface CrmNote {
  text: string;
  createdAt: string;  // ISO
}

export interface CrmEntry {
  bookingId: string;
  noReviewStatus: NoReviewStatus;
  contactedAt?: string;   // stamped when status → contacted
  receivedAt?: string;    // stamped when status → received
  subStarStatus?: SubStarStatus;
  subStarRoute?: "change-review" | "dispute";
  subStarActedAt?: string;
  notes: CrmNote[];
  updatedAt: string;
}

export type CrmStore = Record<string, CrmEntry>;

function blank(bookingId: string): CrmEntry {
  return { bookingId, noReviewStatus: "pending", notes: [], updatedAt: new Date().toISOString() };
}

export async function getCrmStore(): Promise<CrmStore> {
  if (!redis) return {};
  try { return (await redis.get<CrmStore>(CRM_KEY)) ?? {}; }
  catch { return {}; }
}

export async function updateCrmEntry(
  bookingId: string,
  patch: Partial<Omit<CrmEntry, "bookingId" | "notes" | "updatedAt">>,
  newNote?: string,
): Promise<CrmEntry> {
  if (!redis) throw new Error("Redis not configured");

  const store = await getCrmStore();
  const existing = store[bookingId] ?? blank(bookingId);
  const now = new Date().toISOString();

  const notes = [...existing.notes];
  if (newNote?.trim()) notes.push({ text: newNote.trim(), createdAt: now });

  const contactedAt = patch.noReviewStatus === "contacted" && !existing.contactedAt
    ? now : existing.contactedAt;
  const receivedAt  = patch.noReviewStatus === "received"  && !existing.receivedAt
    ? now : existing.receivedAt;
  const subStarActedAt = patch.subStarStatus && patch.subStarStatus !== "pending" && patch.subStarStatus !== "resolved" && !existing.subStarActedAt
    ? now : existing.subStarActedAt;

  const updated: CrmEntry = { ...existing, ...patch, contactedAt, receivedAt, subStarActedAt, notes, updatedAt: now };
  store[bookingId] = updated;
  await redis.set(CRM_KEY, store);
  return updated;
}
