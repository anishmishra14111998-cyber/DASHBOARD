import { Redis } from "@upstash/redis";

const redis = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
  ? new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN })
  : null;

// Separate key from review-crm so checkout outreach is tracked independently.
const CRM_KEY = "checkout-crm:v1";

export interface CheckoutCrmEntry {
  bookingId: string;
  contacted: boolean;
  contactedBy?: string;     // staff name from GUEST_MGMT_STAFF
  contactedAt?: string;     // ISO, stamped first time `contacted` flips true
  update: string;           // free-text update from the staff member
  updatedAt: string;        // ISO
}

export type CheckoutCrmStore = Record<string, CheckoutCrmEntry>;

function blank(bookingId: string): CheckoutCrmEntry {
  return {
    bookingId,
    contacted: false,
    update: "",
    updatedAt: new Date().toISOString(),
  };
}

export async function getCheckoutCrmStore(): Promise<CheckoutCrmStore> {
  if (!redis) return {};
  try { return (await redis.get<CheckoutCrmStore>(CRM_KEY)) ?? {}; }
  catch { return {}; }
}

export interface CheckoutCrmPatch {
  contacted?: boolean;
  contactedBy?: string | null; // null to clear
  update?: string;
}

export async function updateCheckoutCrmEntry(
  bookingId: string,
  patch: CheckoutCrmPatch,
): Promise<CheckoutCrmEntry> {
  if (!redis) throw new Error("Redis not configured");

  const store = await getCheckoutCrmStore();
  const existing = store[bookingId] ?? blank(bookingId);
  const now = new Date().toISOString();

  const contacted = patch.contacted ?? existing.contacted;
  const contactedAt = contacted && !existing.contactedAt ? now : existing.contactedAt;
  const contactedBy = patch.contactedBy === null
    ? undefined
    : (patch.contactedBy ?? existing.contactedBy);
  const update = patch.update ?? existing.update;

  const updated: CheckoutCrmEntry = {
    bookingId,
    contacted,
    contactedBy,
    contactedAt,
    update,
    updatedAt: now,
  };
  store[bookingId] = updated;
  await redis.set(CRM_KEY, store);
  return updated;
}
