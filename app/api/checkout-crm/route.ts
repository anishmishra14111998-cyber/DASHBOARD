import { NextResponse } from "next/server";
import {
  getCheckoutCrmStore,
  updateCheckoutCrmEntry,
  type CheckoutCrmPatch,
} from "@/lib/checkoutCrm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    return NextResponse.json(await getCheckoutCrmStore());
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json() as {
      bookingId: string;
    } & CheckoutCrmPatch;
    const { bookingId, ...patch } = body;
    if (!bookingId) {
      return NextResponse.json({ error: "bookingId required" }, { status: 400 });
    }
    const updated = await updateCheckoutCrmEntry(bookingId, patch);
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
