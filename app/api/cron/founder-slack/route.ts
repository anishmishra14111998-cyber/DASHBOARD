import { NextResponse } from "next/server";
import { buildFounderSnapshot, type FounderSnapshot } from "@/lib/founder";

// Daily founder update — fires from Vercel Cron at 15 21 * * * UTC
// (= 02:45 AM IST). Posts a rich Slack Block Kit message to the founder
// channel summarising the four headline metrics. No screenshot pipeline —
// Vercel's runtime can't run headless Chromium reliably (libnss3 missing),
// and a well-formatted Block Kit message is more scannable on mobile anyway.
//
// Manual invocation:
//   curl -H "Authorization: Bearer $CRON_SECRET" \
//        https://<host>/api/cron/founder-slack

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SLACK_API = "https://slack.com/api";

const fmtK = (n: number): string =>
  n >= 10_000
    ? `$${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}K`
    : `$${Math.round(n).toLocaleString()}`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function retry<T>(fn: () => Promise<T>, attempts: number, label: string): Promise<T> {
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

function fmtIstDate(): string {
  // 3 AM IST report should be labelled with the IST calendar date.
  const now = new Date();
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday:  "long",
    month:    "long",
    day:      "numeric",
    year:     "numeric",
  }).format(now);
}

// Slack Block Kit payload — header, four metric sections, divider, footer link.
function buildBlocks(snap: FounderSnapshot, dashboardUrl?: string) {
  const { pickup, occupancy, todayOccupancy, reviews } = snap;

  // --- 1. Revenue Pickup ---
  const paceEmoji =
    pickup.paceStatus === "ahead"  ? ":chart_with_upwards_trend:" :
    pickup.paceStatus === "behind" ? ":warning:"                 :
                                     ":white_check_mark:";
  const paceText =
    pickup.paceStatus === "ahead"
      ? `*Ahead* by ${fmtK(pickup.variance)} ` +
        `_(day ${pickup.daysElapsed} of ${pickup.daysInMonth}, expected pace ${fmtK(pickup.expectedPace)})_`
      : pickup.paceStatus === "behind"
      ? `*Behind* by ${fmtK(Math.abs(pickup.variance))} ` +
        `_(day ${pickup.daysElapsed} of ${pickup.daysInMonth}, expected pace ${fmtK(pickup.expectedPace)})_`
      : `*On track* _(day ${pickup.daysElapsed} of ${pickup.daysInMonth}, pace ${fmtK(pickup.expectedPace)})_`;

  const pickupSection =
    `*:dart: 1 · Revenue Pickup — Pacing vs Target*\n` +
    `*${fmtK(pickup.actualMtdRevenue)}* / ${fmtK(pickup.target)} · *${pickup.pctOfTarget.toFixed(0)}% of monthly goal*\n` +
    `${paceEmoji} ${paceText}\n` +
    `:moneybag: Yesterday: ${fmtK(pickup.yesterdayRevenue)} from ${pickup.yesterdayBookings} new booking${pickup.yesterdayBookings === 1 ? "" : "s"}`;

  // --- 2. 30-Day Forward Occupancy ---
  const fwdEmoji =
    occupancy.occupancyPct >= 70 ? ":large_green_circle:" :
    occupancy.occupancyPct >= 50 ? ":large_yellow_circle:" :
                                   ":red_circle:";
  const fwdSection =
    `*:office: 2 · Portfolio Occupancy — 30-Day Forward*\n` +
    `${fwdEmoji} *${occupancy.occupancyPct.toFixed(1)}%* occupancy · ${occupancy.occupiedNights.toLocaleString()} / ${occupancy.totalNightsAvailable.toLocaleString()} nights\n` +
    `*${(occupancy.totalNightsAvailable - occupancy.occupiedNights).toLocaleString()}* nights still open across ${occupancy.totalProperties} listings`;

  // --- 3. Today's Occupancy ---
  const todayEmoji =
    todayOccupancy.occupancyPct >= 70 ? ":large_green_circle:" :
    todayOccupancy.occupancyPct >= 50 ? ":large_yellow_circle:" :
                                        ":red_circle:";
  const todaySection =
    `*:house: 3 · Today's Occupancy*\n` +
    `${todayEmoji} *${todayOccupancy.occupancyPct}%* · ${todayOccupancy.occupied} of ${todayOccupancy.totalProperties} listings with guests\n` +
    `${todayOccupancy.vacant} vacant tonight`;

  // --- 4. Trailing 30-Day Reviews ---
  const reviewEmoji =
    reviews.avg >= 4.7 ? ":large_green_circle:" :
    reviews.avg >= 4.3 ? ":large_yellow_circle:" :
    reviews.avg <= 0   ? ":white_circle:"       :
                         ":red_circle:";
  const stars = reviews.avg > 0
    ? "★".repeat(Math.round(reviews.avg)) + "☆".repeat(5 - Math.round(reviews.avg))
    : "—";
  const trend =
    reviews.delta > 0.01  ? `:chart_with_upwards_trend: *+${reviews.delta.toFixed(2)}* vs prior 30 days (was ${reviews.prevAvg.toFixed(2)})` :
    reviews.delta < -0.01 ? `:chart_with_downwards_trend: *${reviews.delta.toFixed(2)}* vs prior 30 days (was ${reviews.prevAvg.toFixed(2)})` :
                            `:white_small_square: flat vs prior 30 days`;
  const reviewSection =
    `*:star: 4 · Average Review Score — Trailing 30 Days*\n` +
    `${reviewEmoji} *${reviews.count > 0 ? reviews.avg.toFixed(2) : "—"} / 5*  ${stars}  _from ${reviews.count} reviews_\n` +
    trend;

  const blocks: object[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `Daily Founder Update · ${fmtIstDate()}` },
    },
    { type: "divider" },
    { type: "section", text: { type: "mrkdwn", text: pickupSection  } },
    { type: "section", text: { type: "mrkdwn", text: fwdSection     } },
    { type: "section", text: { type: "mrkdwn", text: todaySection   } },
    { type: "section", text: { type: "mrkdwn", text: reviewSection  } },
  ];

  if (dashboardUrl) {
    blocks.push({
      type: "context",
      elements: [
        { type: "mrkdwn", text: `:bar_chart: View the live dashboard → <${dashboardUrl}/founder|/founder>` },
      ],
    });
  }

  return blocks;
}

// Plain-text fallback used for the Slack notification preview + screen
// readers when blocks aren't rendered.
function buildFallbackText(snap: FounderSnapshot): string {
  const { pickup, occupancy, todayOccupancy, reviews } = snap;
  const pace =
    pickup.paceStatus === "ahead"  ? `ahead by ${fmtK(pickup.variance)}` :
    pickup.paceStatus === "behind" ? `behind by ${fmtK(Math.abs(pickup.variance))}` :
                                     "on track";
  return [
    `Daily Founder Update — ${fmtIstDate()}`,
    `Pacing: ${fmtK(pickup.actualMtdRevenue)} / ${fmtK(pickup.target)} (${pickup.pctOfTarget.toFixed(0)}%) · ${pace}`,
    `30-day forward occupancy: ${occupancy.occupancyPct.toFixed(1)}%`,
    `Today's occupancy: ${todayOccupancy.occupancyPct}% (${todayOccupancy.occupied}/${todayOccupancy.totalProperties})`,
    `Trailing 30-day rating: ${reviews.count > 0 ? reviews.avg.toFixed(2) : "—"} from ${reviews.count} reviews`,
  ].join(" · ");
}

async function postToSlack(snap: FounderSnapshot): Promise<void> {
  const token   = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_FOUNDER_CHANNEL;
  if (!token)   throw new Error("SLACK_BOT_TOKEN not set");
  if (!channel) throw new Error("SLACK_FOUNDER_CHANNEL not set");

  const blocks = buildBlocks(snap, process.env.DASHBOARD_PUBLIC_URL);
  const text   = buildFallbackText(snap);

  const res = await fetch(`${SLACK_API}/chat.postMessage`, {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ channel, text, blocks, unfurl_links: false }),
  });
  const json = await res.json() as { ok: boolean; error?: string };
  if (!json.ok) throw new Error(`chat.postMessage failed: ${json.error ?? "unknown"}`);
}

function unauthorised(): Response {
  return new Response("Unauthorized", { status: 401 });
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) return unauthorised();

  try {
    const snap = await buildFounderSnapshot();
    await retry(() => postToSlack(snap), 3, "slack-post");
    return NextResponse.json({ ok: true, postedAt: new Date().toISOString() });
  } catch (err) {
    console.error("[founder-slack] giving up:", err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
