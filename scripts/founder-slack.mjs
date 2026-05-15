// Daily founder-update poster. Runs on GitHub Actions (see
// .github/workflows/founder-slack.yml). Renders /founder in headless
// Chromium, posts the PNG to Slack, and falls back to a text-only
// post if any step fails so the founder still gets the numbers.
//
// Required env:
//   DASHBOARD_URL          - https://revenue-dashboard-eight-beta.vercel.app
//   DASHBOARD_USER         - basic-auth user
//   DASHBOARD_PASS         - basic-auth pass
//   SLACK_BOT_TOKEN        - xoxb-...
//   SLACK_FOUNDER_CHANNEL  - C0123ABC4
//
// Local invocation (after `npm i playwright && npx playwright install chromium`):
//   DASHBOARD_URL=... DASHBOARD_USER=... ... node scripts/founder-slack.mjs

import { chromium } from "playwright";

const env = (name) => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
};

const DASHBOARD_URL         = env("DASHBOARD_URL");
const DASHBOARD_USER        = env("DASHBOARD_USER");
const DASHBOARD_PASS        = env("DASHBOARD_PASS");
const SLACK_BOT_TOKEN       = env("SLACK_BOT_TOKEN");
const SLACK_FOUNDER_CHANNEL = env("SLACK_FOUNDER_CHANNEL");

const SLACK_API = "https://slack.com/api";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function retry(fn, attempts, label) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === attempts - 1) break;
      const delay = Math.round(500 * Math.pow(2, i) + Math.random() * 250);
      console.warn(`[${label}] attempt ${i + 1}/${attempts} failed: ${err.message}. Retrying in ${delay}ms.`);
      await sleep(delay);
    }
  }
  throw lastErr;
}

async function captureScreenshot() {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      httpCredentials: { username: DASHBOARD_USER, password: DASHBOARD_PASS },
      viewport:         { width: 1600, height: 1000 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    await page.goto(`${DASHBOARD_URL}/founder`, { waitUntil: "networkidle", timeout: 45_000 });
    // Wait for at least one card title to render — the page does its own
    // client-side fetch of /api/founder so this confirms data is in.
    await page.waitForSelector("section h2", { timeout: 20_000 });
    // Let the fade-in animation settle.
    await sleep(800);
    return await page.screenshot({ type: "png", fullPage: false });
  } finally {
    await browser.close().catch(() => {});
  }
}

async function fetchSnapshot() {
  const auth = "Basic " + Buffer.from(`${DASHBOARD_USER}:${DASHBOARD_PASS}`).toString("base64");
  const res  = await fetch(`${DASHBOARD_URL}/api/founder`, { headers: { Authorization: auth } });
  if (!res.ok) throw new Error(`GET /api/founder failed: ${res.status}`);
  return await res.json();
}

function buildCaption(snap) {
  const today = snap.todayOccupancy?.date ?? new Date().toISOString().slice(0, 10);
  const fmtK = (n) =>
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

async function postScreenshotToSlack(png, caption) {
  // Step 1: get a one-time upload URL.
  const step1 = await fetch(`${SLACK_API}/files.getUploadURLExternal`, {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${SLACK_BOT_TOKEN}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      filename: "founder-update.png",
      length:   String(png.length),
    }).toString(),
  }).then(r => r.json());
  if (!step1.ok) throw new Error(`files.getUploadURLExternal: ${step1.error}`);

  // Step 2: upload bytes.
  const step2 = await fetch(step1.upload_url, {
    method:  "POST",
    headers: { "Content-Type": "image/png" },
    body:    png,
  });
  if (!step2.ok) throw new Error(`Upload POST: ${step2.status} ${await step2.text()}`);

  // Step 3: complete + share to channel with caption.
  const today = new Date().toISOString().slice(0, 10);
  const step3 = await fetch(`${SLACK_API}/files.completeUploadExternal`, {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      files:           [{ id: step1.file_id, title: `Founder Update — ${today}` }],
      channel_id:      SLACK_FOUNDER_CHANNEL,
      initial_comment: caption,
    }),
  }).then(r => r.json());
  if (!step3.ok) throw new Error(`files.completeUploadExternal: ${step3.error}`);
}

async function postTextFallback(message) {
  await fetch(`${SLACK_API}/chat.postMessage`, {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ channel: SLACK_FOUNDER_CHANNEL, text: message }),
  });
}

async function main() {
  // Snapshot + screenshot can be fetched in parallel — they don't depend on each other.
  const [snap, pngResult] = await Promise.allSettled([
    retry(fetchSnapshot,     3, "fetch-snapshot"),
    retry(captureScreenshot, 3, "screenshot"),
  ]);

  // The snapshot is required for the caption. If it fails entirely, bail with text.
  if (snap.status === "rejected") {
    await postTextFallback(`:rotating_light: Founder Update failed to fetch snapshot: ${snap.reason.message}`);
    throw snap.reason;
  }
  const caption = buildCaption(snap.value);

  if (pngResult.status === "rejected") {
    console.warn("Screenshot failed after retries, posting text fallback:", pngResult.reason.message);
    await postTextFallback(`${caption}\n_(image render failed: ${pngResult.reason.message})_`);
    return;
  }

  try {
    await retry(() => postScreenshotToSlack(pngResult.value, caption), 3, "slack-upload");
    console.log("Posted founder update with screenshot.");
  } catch (err) {
    console.warn("Slack upload failed after retries, posting text fallback:", err.message);
    await postTextFallback(`${caption}\n_(image upload failed: ${err.message})_`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
