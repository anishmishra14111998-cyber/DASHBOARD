import { NextResponse } from "next/server";
import chromium from "@sparticuz/chromium-min";
import puppeteer, { type Browser } from "puppeteer-core";

// chromium-min downloads the headless Chromium pack at runtime from this URL
// (cached in /tmp across warm invocations). Vercel's serverless runtime is
// missing libnss3.so so we can't use the bundled @sparticuz/chromium variant
// — the pack URL bundles libnss3 alongside the binary in a single tar.
const CHROMIUM_PACK_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar";
import { buildFounderSnapshot } from "@/lib/founder";
import { nyToday } from "@/lib/datetime";

// This route is called by Vercel Cron at 0 7 * * * UTC (≈ 3 AM NY).
// It is carved out of the basic-auth middleware (see middleware.ts) so the
// cron runner can reach it; access is gated by a CRON_SECRET bearer token
// that Vercel attaches automatically to scheduled invocations.
//
// Manual invocation for testing:
//   curl -H "Authorization: Bearer $CRON_SECRET" \
//        https://<host>/api/cron/founder-slack

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Hobby tier cap; Pro can extend to 300.

const SLACK_API = "https://slack.com/api";

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Retry helper — exponential backoff with jitter. Returns the first
// successful result, or throws the last error after `attempts` tries.
async function retry<T>(
  fn: () => Promise<T>,
  attempts: number,
  label: string,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === attempts - 1) break;
      const delay = Math.round(500 * Math.pow(2, i) + Math.random() * 250);
      console.warn(`[founder-slack] ${label} attempt ${i + 1}/${attempts} failed: ${(err as Error).message}. Retrying in ${delay}ms.`);
      await sleep(delay);
    }
  }
  throw lastErr;
}

async function captureScreenshot(): Promise<Uint8Array> {
  const baseUrl  = process.env.DASHBOARD_PUBLIC_URL;
  const username = process.env.DASHBOARD_USER;
  const password = process.env.DASHBOARD_PASS;
  if (!baseUrl)  throw new Error("DASHBOARD_PUBLIC_URL not set");
  if (!username || !password) throw new Error("DASHBOARD_USER/PASS not set");

  let browser: Browser | undefined;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1600, height: 1000, deviceScaleFactor: 2 },
      executablePath: await chromium.executablePath(CHROMIUM_PACK_URL),
      headless: true,
    });
    const page = await browser.newPage();
    // Basic auth on every request (including the in-page /api/founder fetch).
    await page.authenticate({ username, password });

    await page.goto(`${baseUrl}/founder`, {
      waitUntil: "networkidle0",
      timeout: 30_000,
    });
    // Make sure data has rendered — the metric span only exists after the
    // /api/founder fetch resolves. If it never appears we still proceed
    // (the page shows skeletons) rather than hanging.
    await page
      .waitForFunction(
        () => !!document.querySelector('section h2'),
        { timeout: 15_000 },
      )
      .catch(() => undefined);
    // Belt-and-suspenders — give the fade-in animation a moment to settle.
    await sleep(800);

    return new Uint8Array(await page.screenshot({ type: "png", fullPage: false }));
  } finally {
    if (browser) await browser.close().catch(() => undefined);
  }
}

interface UploadUrlResult { upload_url: string; file_id: string }

async function postToSlack(png: Uint8Array, caption: string): Promise<void> {
  const token   = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_FOUNDER_CHANNEL;
  if (!token)   throw new Error("SLACK_BOT_TOKEN not set");
  if (!channel) throw new Error("SLACK_FOUNDER_CHANNEL not set");

  // Step 1: get a one-time upload URL (modern file upload API).
  const step1 = await fetch(`${SLACK_API}/files.getUploadURLExternal`, {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      filename: "founder-update.png",
      length:   String(png.length),
    }).toString(),
  }).then(r => r.json() as Promise<{ ok: boolean; upload_url?: string; file_id?: string; error?: string }>);
  if (!step1.ok || !step1.upload_url || !step1.file_id) {
    throw new Error(`files.getUploadURLExternal failed: ${step1.error ?? "unknown"}`);
  }
  const { upload_url, file_id } = step1 as UploadUrlResult;

  // Step 2: PUT the bytes to that URL. Cast: TS's lib.dom + lib.webworker
  // typings narrow BodyInit to Uint8Array<ArrayBuffer>, but puppeteer hands
  // back Uint8Array<ArrayBufferLike>. The bytes are valid at runtime.
  const step2 = await fetch(upload_url, {
    method:  "POST",
    headers: { "Content-Type": "image/png" },
    body:    png as unknown as BodyInit,
  });
  if (!step2.ok) {
    throw new Error(`Upload PUT failed: ${step2.status} ${await step2.text()}`);
  }

  // Step 3: complete the upload and share it to the channel with a caption.
  const step3 = await fetch(`${SLACK_API}/files.completeUploadExternal`, {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      files:           [{ id: file_id, title: `Founder Update — ${nyToday()}` }],
      channel_id:      channel,
      initial_comment: caption,
    }),
  }).then(r => r.json() as Promise<{ ok: boolean; error?: string }>);
  if (!step3.ok) {
    throw new Error(`files.completeUploadExternal failed: ${step3.error ?? "unknown"}`);
  }
}

async function postTextFallback(message: string): Promise<void> {
  const token   = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_FOUNDER_CHANNEL;
  if (!token || !channel) return;

  await fetch(`${SLACK_API}/chat.postMessage`, {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ channel, text: message }),
  });
}

function buildCaption(today: string, snap: Awaited<ReturnType<typeof buildFounderSnapshot>>): string {
  const fmtK = (n: number) =>
    n >= 10_000 ? `$${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}K` : `$${Math.round(n)}`;
  const pace =
    snap.pickup.paceStatus === "ahead"
      ? `:chart_with_upwards_trend: ahead by ${fmtK(snap.pickup.variance)}`
      : snap.pickup.paceStatus === "behind"
      ? `:warning: behind by ${fmtK(Math.abs(snap.pickup.variance))}`
      : ":white_check_mark: on track";
  return [
    `*Daily Founder Update — ${today}*`,
    `• Pacing: ${fmtK(snap.pickup.actualMtdRevenue)} / ${fmtK(snap.pickup.target)} (${snap.pickup.pctOfTarget.toFixed(0)}%) · ${pace}`,
    `• 30-day forward occupancy: ${snap.occupancy.occupancyPct.toFixed(1)}%`,
    `• Today's occupancy: ${snap.todayOccupancy.occupancyPct}% (${snap.todayOccupancy.occupied}/${snap.todayOccupancy.totalProperties})`,
    `• Trailing 30-day rating: ${snap.reviews.count > 0 ? snap.reviews.avg.toFixed(2) : "—"} (${snap.reviews.count} reviews)`,
  ].join("\n");
}

function unauthorised(): Response {
  return new Response("Unauthorized", { status: 401 });
}

export async function GET(req: Request) {
  // Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` automatically
  // when CRON_SECRET is set on the project. We reject anything else so the
  // open URL can't be triggered by a stranger.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) return unauthorised();

  const today = nyToday();
  let snapshot: Awaited<ReturnType<typeof buildFounderSnapshot>>;
  try {
    snapshot = await buildFounderSnapshot();
  } catch (err) {
    // If even the snapshot fails, tell Slack so silence isn't the only signal.
    await postTextFallback(
      `:rotating_light: Founder Update for ${today} failed to compute: ${(err as Error).message}`,
    ).catch(() => undefined);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  const caption = buildCaption(today, snapshot);

  // Take the screenshot and upload, both with backoff.
  try {
    const png = await retry(captureScreenshot, 3, "screenshot");
    await retry(() => postToSlack(png, caption), 3, "slack-upload");
    return NextResponse.json({ ok: true, today });
  } catch (err) {
    // Hard failure on screenshot or upload — fall back to a text-only post
    // so the founder still gets the numbers even if the image pipeline broke.
    await postTextFallback(
      `${caption}\n_(image render failed: ${(err as Error).message})_`,
    ).catch(() => undefined);
    return NextResponse.json(
      { ok: false, error: (err as Error).message, fellBackToText: true },
      { status: 500 },
    );
  }
}
