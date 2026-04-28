import { NextResponse } from "next/server";
import { fetchReviews } from "@/lib/reviews";
import { fetchListingNamesAll } from "@/lib/guesty";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    // Pull *all* listings (active + inactive) so reviews from archived
    // properties still resolve to real names instead of bare IDs.
    const names = await fetchListingNamesAll();
    const result = await fetchReviews(names);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
