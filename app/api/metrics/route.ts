import { NextResponse } from "next/server";
import { fetchGuesty } from "@/lib/guesty";
import type { MetricsResponse } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const guesty = await fetchGuesty();

  const payload: MetricsResponse = {
    generatedAt: new Date().toISOString(),
    sources: { guesty: guesty.status },
    properties: guesty.properties,
    reservations: guesty.reservations,
  };

  return NextResponse.json(payload);
}
