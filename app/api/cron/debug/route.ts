import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json({
    node: process.version,
    arch: process.arch,
    platform: process.platform,
    env_arch: process.env.AWS_EXECUTION_ENV ?? null,
  });
}
