import { NextResponse } from "next/server";
import { buildFounderSnapshot } from "@/lib/founder";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    return NextResponse.json(await buildFounderSnapshot());
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
