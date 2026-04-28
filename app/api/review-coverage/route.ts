import { NextResponse } from "next/server";
import { fetchGuesty, fetchListingNamesAll } from "@/lib/guesty";
import { fetchReviews } from "@/lib/reviews";
import { nyToday } from "@/lib/datetime";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export interface CoverageBooking {
  id: string;
  confirmationCode: string;
  channel: string;
  propertyId: string;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  hasReview: boolean;
  reviewRating: number | null;
  reviewCreatedAt: string;
  reviewText: string;
}

export interface CoverageResponse {
  generatedAt: string;
  bookings: CoverageBooking[];
}

export async function GET() {
  try {
    // Fetch reservations + names in parallel; reviews uses its own (cached) path.
    const [guesty, names] = await Promise.all([fetchGuesty(), fetchListingNamesAll()]);
    const reviews = await fetchReviews(names);

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
    const bookings: CoverageBooking[] = [];
    for (const res of guesty.reservations) {
      if (res.status !== "confirmed") continue;
      // Only stays that have actually completed are eligible for reviews.
      if (res.checkOut > today) continue;

      const review = reviewByReservation.get(res.id);
      bookings.push({
        id: res.id,
        confirmationCode: res.confirmationCode || res.id,
        channel: res.channel,
        propertyId: res.propertyId,
        propertyName: res.propertyName,
        checkIn: res.checkIn,
        checkOut: res.checkOut,
        hasReview: !!review,
        reviewRating: review?.rating ?? null,
        reviewCreatedAt: review?.createdAt ?? "",
        reviewText: review?.publicReview ?? "",
      });
    }

    // Newest checkouts first so the most recent stays surface at the top.
    bookings.sort((a, b) => (a.checkOut < b.checkOut ? 1 : -1));

    const payload: CoverageResponse = {
      generatedAt: new Date().toISOString(),
      bookings,
    };
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
