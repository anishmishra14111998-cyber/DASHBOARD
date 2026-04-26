# Revenue Dashboard

Live revenue & expenses dashboard for short-term-rental properties, powered by **Guesty**. Booking.com and Airbnb reservations come through Guesty automatically (Guesty syncs them and tags each reservation with its source).

## Run

```bash
cd ~/Projects/revenue-dashboard
npm install
npm run dev
# http://localhost:3000
```

## Configure

Edit `.env.local`:

```env
GUESTY_CLIENT_ID=...
GUESTY_CLIENT_SECRET=...
```

Get these from `Guesty → Integrations → Open API`. Restart `npm run dev` after changing env vars.

If credentials are missing or invalid, the dashboard falls back to deterministic mock data so the UI still renders.

## What it shows

- **KPIs:** Gross Revenue, Net Revenue, Expenses, Net Profit (margin), Occupied Nights, ADR, Last Sync
- **Monthly bar chart:** revenue vs expenses
- **Channel breakdown:** Direct vs Booking.com vs Airbnb (split by Guesty's `source` field)
- **Recent expenses table** + **per-property filter**
- **Auto-refresh every 15s** + manual "Refresh now" button

## Layout

```
app/
  api/metrics/route.ts   # Calls Guesty, returns aggregated JSON
  page.tsx               # Dashboard UI
lib/
  guesty.ts              # OAuth2 + reservations client (with mock fallback)
  mockData.ts            # Mock data used as fallback
  aggregate.ts           # KPI / monthly / channel-breakdown math
  types.ts
components/              # MetricCard, RevenueChart, ChannelBreakdown, …
```

The browser only ever talks to `/api/metrics` — Guesty credentials stay server-side.

## True real-time (next step)

Auto-refresh polls every 15s. For instant updates on new reservations, point Guesty webhooks at a new `app/api/webhooks/guesty/route.ts` and have the dashboard subscribe via Server-Sent Events. Requires a public URL (ngrok or a deploy).
