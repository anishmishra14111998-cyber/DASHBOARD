import { fetchGuesty, fetchListingNamesAll } from "@/lib/guesty";
import { fetchReviews } from "@/lib/reviews";
import { nyToday } from "@/lib/datetime";
import { getCheckoutCrmStore } from "@/lib/checkoutCrm";

export interface Checkout {
  id: string;                  // reservation id (used as CRM bookingId)
  confirmationCode: string;
  channel: string;
  propertyId: string;
  propertyName: string;
  checkIn: string;             // YYYY-MM-DD
  checkOut: string;            // YYYY-MM-DD

  // CRM-tracked fields
  contacted: boolean;
  contactedBy?: string;
  contactedAt?: string;
  update: string;

  // From reviews
  reviewReceived: boolean;
  reviewRating: number | null;
  reviewCreatedAt: string;
}

export interface CheckoutsResult {
  generatedAt: string;
  checkouts: Checkout[];
}

export async function fetchCheckouts(): Promise<CheckoutsResult> {
  const [guesty, names] = await Promise.all([fetchGuesty(), fetchListingNamesAll()]);
  const [reviews, crm] = await Promise.all([
    fetchReviews(names),
    getCheckoutCrmStore(),
  ]);

  // One review per reservation (latest if duplicates).
  const reviewByReservation = new Map<string, (typeof reviews.reviews)[number]>();
  for (const r of reviews.reviews) {
    if (!r.reservationId) continue;
    const existing = reviewByReservation.get(r.reservationId);
    if (!existing || r.createdAt > existing.createdAt) {
      reviewByReservation.set(r.reservationId, r);
    }
  }

  const today = nyToday();
  const checkouts: Checkout[] = [];
  for (const res of guesty.reservations) {
    if (res.status !== "confirmed") continue;
    // Only stays that have already completed are eligible for checkout follow-up.
    if (res.checkOut > today) continue;

    const review = reviewByReservation.get(res.id);
    const entry = crm[res.id];

    checkouts.push({
      id: res.id,
      confirmationCode: res.confirmationCode || res.id,
      channel: res.channel,
      propertyId: res.propertyId,
      propertyName: res.propertyName,
      checkIn: res.checkIn,
      checkOut: res.checkOut,

      contacted: entry?.contacted ?? false,
      contactedBy: entry?.contactedBy,
      contactedAt: entry?.contactedAt,
      update: entry?.update ?? "",

      reviewReceived: !!review,
      reviewRating: review?.rating ?? null,
      reviewCreatedAt: review?.createdAt ?? "",
    });
  }

  // Newest checkouts first.
  checkouts.sort((a, b) => (a.checkOut < b.checkOut ? 1 : -1));

  return {
    generatedAt: new Date().toISOString(),
    checkouts,
  };
}
