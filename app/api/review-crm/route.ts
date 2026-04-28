import { NextResponse } from "next/server";
import { getCrmStore, updateCrmEntry } from "@/lib/reviewCrm";
import type { CrmEntry, CrmStore, NoReviewStatus, SubStarStatus } from "@/lib/reviewCrm";

export { CrmEntry, CrmStore };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    return NextResponse.json(await getCrmStore());
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json() as {
      bookingId: string;
      noReviewStatus?: NoReviewStatus;
      subStarStatus?: SubStarStatus;
      subStarRoute?: "change-review" | "dispute";
      note?: string;
    };
    const { bookingId, note, ...patch } = body;
    if (!bookingId) return NextResponse.json({ error: "bookingId required" }, { status: 400 });
    const updated = await updateCrmEntry(bookingId, patch, note);
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
