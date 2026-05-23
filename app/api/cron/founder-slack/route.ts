import { NextResponse } from "next/server";
import { buildFounderSnapshot, type FounderSnapshot } from "@/lib/founder";
import { buildLinkToken } from "@/lib/linkToken";
import { readWhatsAppConfig, sendWhatsAppToAll } from "@/lib/whatsapp";

// Daily founder update — fires from Vercel Cron twice a day:
//   0 14 * * * UTC  =  09:00 AM EST  (10:00 AM EDT)
//   0 23 * * * UTC  =  06:00 PM EST  ( 7:00 PM EDT)
// Vercel Hobby caps cron at 2 entries × 1 fire/day each, so a third slot
// (e.g. 9 PM EST) would need a Pro upgrade or an external scheduler.
// Posts a rich Slack Block Kit message to the founder
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
// `linkUrl` already has any auth token / credentials baked in.
function buildBlocks(snap: FounderSnapshot, linkUrl?: string) {
  const { pickup, occupancy, todayOccupancy, reviews } = snap;

  // Emoji policy: only the four section titles get an emoji. Body text is
  // plain — status is conveyed in words ("Ahead by", "Behind by") and
  // formatting (bold for the headline number).

  // --- 1. Revenue Pickup ---
  const paceText =
    pickup.paceStatus === "ahead"
      ? `*Ahead* by ${fmtK(pickup.variance)} _(day ${pickup.daysElapsed} of ${pickup.daysInMonth}, expected pace ${fmtK(pickup.expectedPace)})_`
      : pickup.paceStatus === "behind"
      ? `*Behind* by ${fmtK(Math.abs(pickup.variance))} _(day ${pickup.daysElapsed} of ${pickup.daysInMonth}, expected pace ${fmtK(pickup.expectedPace)})_`
      : `*On track* _(day ${pickup.daysElapsed} of ${pickup.daysInMonth}, pace ${fmtK(pickup.expectedPace)})_`;

  const pickupSection =
    `*:dart: 1 · Revenue Pickup — Pacing vs Target*\n` +
    `*${fmtK(pickup.actualMtdRevenue)}* / ${fmtK(pickup.target)} · *${pickup.pctOfTarget.toFixed(0)}% of monthly goal*\n` +
    `${paceText}\n` +
    `Yesterday: ${fmtK(pickup.yesterdayRevenue)} from ${pickup.yesterdayBookings} new booking${pickup.yesterdayBookings === 1 ? "" : "s"}`;

  // --- 2. 30-Day Forward Occupancy ---
  const fwdSection =
    `*:office: 2 · Portfolio Occupancy — 30-Day Forward*\n` +
    `*${occupancy.occupancyPct.toFixed(1)}%* occupancy · ${occupancy.occupiedNights.toLocaleString()} / ${occupancy.totalNightsAvailable.toLocaleString()} nights\n` +
    `*${(occupancy.totalNightsAvailable - occupancy.occupiedNights).toLocaleString()}* nights still open across ${occupancy.totalProperties} listings`;

  // --- 3. Today's Occupancy ---
  const todaySection =
    `*:house: 3 · Today's Occupancy*\n` +
    `*${todayOccupancy.occupancyPct}%* · ${todayOccupancy.occupied} of ${todayOccupancy.totalProperties} listings with guests\n` +
    `${todayOccupancy.vacant} vacant tonight`;

  // --- 4. Trailing 30-Day Reviews ---
  const trend =
    reviews.delta > 0.01  ? `*+${reviews.delta.toFixed(2)}* vs prior 30 days (was ${reviews.prevAvg.toFixed(2)})` :
    reviews.delta < -0.01 ? `*${reviews.delta.toFixed(2)}* vs prior 30 days (was ${reviews.prevAvg.toFixed(2)})` :
                            `flat vs prior 30 days`;
  const reviewSection =
    `*:star: 4 · Average Review Score — Trailing 30 Days*\n` +
    `*${reviews.count > 0 ? reviews.avg.toFixed(2) : "—"} / 5* · ${reviews.count} reviews · ${trend}`;

  // --- 5. Bookings & Pipeline ---
  const { newBookings, nextMonth, advance } = snap;
  const pipelineSection =
    `*:calendar: 5 · Bookings & Pipeline*\n` +
    `New bookings (${newBookings.monthLabel}): *${newBookings.count}* · ${fmtK(newBookings.amount)}\n` +
    `Next month (${nextMonth.monthLabel}) on the books: *${fmtK(nextMonth.bookedRevenue)}* · ${nextMonth.bookedNights.toLocaleString()} nights (${nextMonth.occupancyPct.toFixed(1)}% occ)\n` +
    `Advance revenue (all future): *${fmtK(advance.revenue)}* across ${advance.count} bookings`;

  const blocks: object[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `Daily Founder Update · ${fmtIstDate()}` },
    },
    { type: "divider" },
    { type: "section", text: { type: "mrkdwn", text: pickupSection   } },
    { type: "section", text: { type: "mrkdwn", text: fwdSection      } },
    { type: "section", text: { type: "mrkdwn", text: todaySection    } },
    { type: "section", text: { type: "mrkdwn", text: reviewSection   } },
    { type: "section", text: { type: "mrkdwn", text: pipelineSection } },
  ];

  if (linkUrl) {
    blocks.push({
      type: "context",
      elements: [
        { type: "mrkdwn", text: `<${linkUrl}|Open the live dashboard →>` },
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
    `New bookings (${snap.newBookings.monthLabel}): ${snap.newBookings.count} · ${fmtK(snap.newBookings.amount)}`,
    `Next month booked: ${fmtK(snap.nextMonth.bookedRevenue)} · ${snap.nextMonth.bookedNights} nights`,
    `Advance revenue: ${fmtK(snap.advance.revenue)} across ${snap.advance.count} bookings`,
  ].join(" · ");
}

async function postToSlack(snap: FounderSnapshot): Promise<void> {
  const token   = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_FOUNDER_CHANNEL;
  if (!token)   throw new Error("SLACK_BOT_TOKEN not set");
  if (!channel) throw new Error("SLACK_FOUNDER_CHANNEL not set");

  // Mint a 7-day signed token. The middleware validates it, sets a session
  // cookie, and redirects to a clean /founder URL so the token doesn't sit
  // in the browser address bar.
  const baseUrl    = process.env.DASHBOARD_PUBLIC_URL;
  const linkSecret = process.env.CRON_SECRET ?? process.env.DASHBOARD_PASS;
  const linkUrl =
    baseUrl && linkSecret
      ? `${baseUrl}/founder?auth=${await buildLinkToken(linkSecret)}`
      : undefined;

  const blocks = buildBlocks(snap, linkUrl);
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

// Builds the 5 ordered body variables for the WhatsApp template
// `founder_daily_update` (see setup guide). Each must be single-line —
// WhatsApp rejects template params containing newlines or tabs.
function buildWhatsAppVars(snap: FounderSnapshot): string[] {
  const { pickup, occupancy, todayOccupancy, reviews } = snap;
  const pace =
    pickup.paceStatus === "ahead"  ? `ahead by ${fmtK(pickup.variance)}` :
    pickup.paceStatus === "behind" ? `behind by ${fmtK(Math.abs(pickup.variance))}` :
                                     "on track";
  return [
    fmtIstDate(),                                                                              // {{1}} date
    `${fmtK(pickup.actualMtdRevenue)} / ${fmtK(pickup.target)} (${pickup.pctOfTarget.toFixed(0)}%), ${pace}`, // {{2}} pacing
    `${occupancy.occupancyPct.toFixed(1)}%`,                                                   // {{3}} 30-day occupancy
    `${todayOccupancy.occupancyPct}% (${todayOccupancy.occupied}/${todayOccupancy.totalProperties})`,         // {{4}} today
    `${reviews.count > 0 ? reviews.avg.toFixed(2) : "—"}/5 from ${reviews.count} reviews`,     // {{5}} reviews
    `${snap.newBookings.count} bookings, ${fmtK(snap.newBookings.amount)}`,                    // {{6}} new bookings this month
    `${fmtK(snap.nextMonth.bookedRevenue)}, ${snap.nextMonth.bookedNights} nights`,            // {{7}} next month booked
    `${fmtK(snap.advance.revenue)} across ${snap.advance.count} bookings`,                     // {{8}} advance revenue
  ];
}

async function sendWhatsApp(snap: FounderSnapshot): Promise<void> {
  const cfg = readWhatsAppConfig();
  if (!cfg) return; // not configured — silently skip
  const results = await sendWhatsAppToAll(cfg, buildWhatsAppVars(snap));
  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error("[founder-slack] WhatsApp partial failure:", JSON.stringify(failed));
  }
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
    // Slack and WhatsApp are independent — a failure in one must not block
    // the other. Each retries internally; we report both outcomes.
    const [slackResult, waResult] = await Promise.allSettled([
      retry(() => postToSlack(snap), 3, "slack-post"),
      retry(() => sendWhatsApp(snap), 3, "whatsapp-post"),
    ]);

    const slackOk = slackResult.status === "fulfilled";
    const waOk    = waResult.status === "fulfilled";
    if (!slackOk) console.error("[founder-slack] Slack failed:", slackResult.reason);
    if (!waOk)    console.error("[founder-slack] WhatsApp failed:", waResult.reason);

    // 200 if at least one channel delivered; 500 only if both failed.
    const status = slackOk || waOk ? 200 : 500;
    return NextResponse.json(
      { ok: slackOk || waOk, slack: slackOk, whatsapp: waOk, postedAt: new Date().toISOString() },
      { status },
    );
  } catch (err) {
    console.error("[founder-slack] giving up:", err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
