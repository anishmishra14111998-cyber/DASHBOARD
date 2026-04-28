import { NextResponse } from "next/server";
import { fetchGrossMarginData } from "@/lib/grossMargin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    return NextResponse.json(await fetchGrossMarginData());
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
