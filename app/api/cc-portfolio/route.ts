import { NextResponse } from "next/server";
import { fetchCCPortfolioData } from "@/lib/ccPortfolio";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    return NextResponse.json(await fetchCCPortfolioData());
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
