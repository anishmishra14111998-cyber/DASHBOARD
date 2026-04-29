const SHEET_ID = "1FkVwnC7cQiNMbPzuaDwrqWcW1RMEkEkLs9YiXJCrWCU";

function csvUrl() {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += c;
    } else {
      if      (c === '"')  inQ = true;
      else if (c === ',')  { row.push(cur); cur = ""; }
      else if (c === '\n') { row.push(cur); cur = ""; rows.push(row); row = []; }
      else if (c === '\r') { /* skip */ }
      else cur += c;
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

function money(s: string): number {
  if (!s) return 0;
  const t = s.trim();
  if (!t || t === "—" || t === "-") return 0;
  const c = t.replace(/[$,\s]/g, "");
  if (c.startsWith("(") && c.endsWith(")")) return -(parseFloat(c.slice(1, -1)) || 0);
  return parseFloat(c) || 0;
}

function pct(s: string): number {
  if (!s) return 0;
  const t = s.trim().replace("%", "").replace(/\s/g, "");
  if (!t || t === "—") return 0;
  if (t.startsWith("(") && t.endsWith(")")) return -(parseFloat(t.slice(1, -1)) || 0);
  return parseFloat(t) || 0;
}

export interface MonthSummary {
  month: string;
  netRevenue: number;
  gm1: number;
  marginPct: number;
}

export interface PropertyGmRow {
  name: string;
  units: number;
  janNet: number;  janGm1: number;
  febNet: number;  febGm1: number;
  marNet: number;  marGm1: number;
  threeMonthNet: number;
  threeMonthGm1: number;
  threeMonthMarginPct: number;
}

export interface PortfolioSummary {
  grossRevenue: number;
  platformFees: number;
  periodRent: number;
  gm1: number;
  marginPct: number;
}

export interface GrossMarginData {
  generatedAt: string;
  portfolio: PortfolioSummary;
  threeMonth: {
    grossRevenue: number;
    commission: number;
    netRevenue: number;
    rentPaid: number;
    gm1: number;
    marginPct: number;
    units: number;
  };
  months: [MonthSummary, MonthSummary, MonthSummary];
  properties: PropertyGmRow[];
}

export async function fetchGrossMarginData(): Promise<GrossMarginData> {
  const res = await fetch(csvUrl(), { cache: "no-store" });
  if (!res.ok) throw new Error(`Gross margin sheet fetch failed: ${res.status}`);
  const rows = parseCsv(await res.text());

  let netRow: string[] = [];
  let gm1Row: string[] = [];
  let propHeaderIdx = -1;
  let totalUnits = 0;
  let portfolioValueRow: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r0 = (rows[i]?.[0] ?? "").trim().toUpperCase();
    if (r0 === "M GROSS REVENUE") portfolioValueRow = rows[i + 1] ?? [];
    if (r0.startsWith("JAN 2026")) {
      netRow = rows[i + 1] ?? [];
      gm1Row = rows[i + 3] ?? [];
    }
    if ((rows[i]?.[0] ?? "").trim() === "Property") propHeaderIdx = i;
    if (r0.includes("PORTFOLIO TOTAL")) totalUnits = parseInt(rows[i]?.[1] ?? "0") || 0;
  }

  const months: [MonthSummary, MonthSummary, MonthSummary] = [
    { month: "Jan 2026", netRevenue: money(netRow[0]), gm1: money(gm1Row[0]), marginPct: 0 },
    { month: "Feb 2026", netRevenue: money(netRow[3]), gm1: money(gm1Row[3]), marginPct: 0 },
    { month: "Mar 2026", netRevenue: money(netRow[6]), gm1: money(gm1Row[6]), marginPct: 0 },
  ].map(m => ({
    ...m,
    marginPct: m.netRevenue ? Math.round((m.gm1 / m.netRevenue) * 1000) / 10 : 0,
  })) as [MonthSummary, MonthSummary, MonthSummary];

  const properties: PropertyGmRow[] = [];
  if (propHeaderIdx >= 0) {
    for (let i = propHeaderIdx + 1; i < rows.length; i++) {
      const row = rows[i] ?? [];
      const name = (row[0] ?? "").trim();
      if (!name || name.startsWith("Methodology")) break;
      if (name.toUpperCase().includes("PORTFOLIO TOTAL")) break;

      const jn = money(row[2]), jg = money(row[3]);
      const fn = money(row[4]), fg = money(row[5]);
      const mn = money(row[6]), mg = money(row[7]);
      const threeMonthNet = jn + fn + mn;
      const threeMonthGm1 = jg + fg + mg;

      properties.push({
        name, units: parseInt(row[1] ?? "1") || 1,
        janNet: jn, janGm1: jg,
        febNet: fn, febGm1: fg,
        marNet: mn, marGm1: mg,
        threeMonthNet, threeMonthGm1,
        threeMonthMarginPct: threeMonthNet > 0
          ? Math.round((threeMonthGm1 / threeMonthNet) * 1000) / 10 : 0,
      });
    }
  }

  const threeMonthNet = months.reduce((s, m) => s + m.netRevenue, 0);
  const threeMonthGm1 = months.reduce((s, m) => s + m.gm1, 0);

  const pGross   = money(portfolioValueRow[0] ?? "");
  const pFees    = money(portfolioValueRow[3] ?? "");
  const pRent    = money(portfolioValueRow[6] ?? "");
  const pGm1     = money(portfolioValueRow[9] ?? "");
  const pMargin  = pGross ? Math.round((pGm1 / (pGross + pFees)) * 1000) / 10 : 0;

  // Derive Jan–Mar gross revenue + commission proportionally:
  // sheet only has full-period (Jan–Apr) splits, so allocate by Jan–Mar's share of net revenue.
  const fullPeriodNet = pGross + pFees; // pFees is negative
  const janMarShare   = fullPeriodNet > 0 ? threeMonthNet / fullPeriodNet : 0;
  const threeMonthGross      = Math.round(pGross * janMarShare);
  const threeMonthCommission = Math.round(pFees  * janMarShare);
  const threeMonthRent       = threeMonthNet - threeMonthGm1;

  return {
    generatedAt: new Date().toISOString(),
    portfolio: {
      grossRevenue: pGross,
      platformFees: pFees,
      periodRent: pRent,
      gm1: pGm1,
      marginPct: pMargin,
    },
    threeMonth: {
      grossRevenue: threeMonthGross,
      commission: threeMonthCommission,
      netRevenue: threeMonthNet,
      rentPaid: threeMonthRent,
      gm1: threeMonthGm1,
      marginPct: threeMonthNet ? Math.round((threeMonthGm1 / threeMonthNet) * 1000) / 10 : 0,
      units: totalUnits,
    },
    months,
    properties: properties.sort((a, b) => b.threeMonthGm1 - a.threeMonthGm1),
  };
}
