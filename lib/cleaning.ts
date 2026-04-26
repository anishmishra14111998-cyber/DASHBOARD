// Server-side fetch of the cleaning workbook from Google Sheets.
// The sheet is public-link-shared, so no OAuth is needed — we just hit the CSV
// export URL for each tab and parse the result.
//
// To swap to a different sheet later, only SHEET_ID + the gids below need updating.

const SHEET_ID = "1y6XwRC7Ax7pax2mhpZd59cyqp8yu2j7wthI4bHN2jto";

const SHEETS = {
  monthly:    { gid: "362642129",  name: "Monthly Dashboard" },
  weekly:     { gid: "1531430431", name: "Weekly Dashboard" },
  costDetail: { gid: "197492965",  name: "Cost Detail (Weekly)" },
} as const;

function csvUrl(gid: string): string {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
}

// Minimal CSV parser. Handles quoted fields, embedded commas, and "" escapes.
// Google Sheets exports clean CSV so this is enough — no need to pull a library.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(cur); cur = ""; }
      else if (c === "\n") { row.push(cur); cur = ""; rows.push(row); row = []; }
      else if (c === "\r") { /* skip */ }
      else cur += c;
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

async function fetchSheet(gid: string): Promise<string[][]> {
  // No cache — we want edits in the Google Sheet to appear in the dashboard
  // on the very next request (cost: ~150KB extra per refresh, fine at our scale).
  const res = await fetch(csvUrl(gid), { cache: "no-store" });
  if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
  return parseCsv(await res.text());
}

// Drop the universal leading-blank-column the workbook uses for left padding,
// and remove fully-empty rows.
function clean(rows: string[][]): string[][] {
  return rows
    .map((r) => (r[0] === "" ? r.slice(1) : r))
    .filter((r) => r.some((c) => c.trim() !== ""));
}

export interface CleaningTable {
  headers: string[];
  rows: string[][];
}

export interface CleaningData {
  generatedAt: string;
  ytd: {
    revenue: string;
    cost: string;
    netPnl: string;
    margin: string;
    avgCostPerClean?: string;
  };
  period: {
    monthly: string;       // e.g. "Jan – Apr 2026 (4 months, April partial)"
    weekly: string;        // e.g. "Jan 2 – Apr 24, 2026 (16 weeks)"
    portfolio?: string;    // e.g. "~60 properties · CLT + RDU markets"
  };
  monthly: CleaningTable;
  weekly: CleaningTable;
  costDetail: CleaningTable;
}

// ---- Per-sheet shape extraction --------------------------------------

function extractMonthly(raw: string[][]): { ytd: CleaningData["ytd"]; period: string; table: CleaningTable } {
  const rows = clean(raw);
  // Layout (after stripping leading blank col + empty rows):
  //   0: COVETED HOSPITALITY · CLEANING FINANCE · MONTH-OVER-MONTH
  //   1: subtitle
  //   2: PERIOD ...
  //   3: YTD CLEANING REVENUE | (blank) | YTD CLEANING COST | ...
  //   4: $139,465 | _ | $218,107 | _ | ($78,642) | _ | (56.4%)
  //   5: METRIC | January 2026 | February 2026 | March 2026 | April 2026 (P) | YTD TOTAL | MoM Δ% | 4-Mo Avg
  //   6+: data rows
  const period = (rows[2]?.[0] ?? "").replace(/^\s*PERIOD\s*·\s*/i, "").trim();
  const ytdRow = rows[4] ?? [];
  const ytd = {
    revenue: ytdRow[0] ?? "",
    cost:    ytdRow[2] ?? "",
    netPnl:  ytdRow[4] ?? "",
    margin:  ytdRow[6] ?? "",
  };
  const headers = rows[5] ?? [];
  const dataRows = rows.slice(6);
  return { ytd, period, table: { headers, rows: dataRows } };
}

function extractWeekly(raw: string[][]): { period: string; portfolio: string; table: CleaningTable; avgCostPerClean: string } {
  const rows = clean(raw);
  // Layout (after cleanup):
  //   0: COVETED HOSPITALITY · CLEANING FINANCE DASHBOARD
  //   1: subtitle
  //   2: PERIOD ... PORTFOLIO ...
  //   3: TOTAL CLEANING REVENUE | _ | _ | _ | TOTAL CLEANING COST | _ | _ | _ | NET PROFIT / (LOSS) | _ | _ | _ | AVG COST PER CLEAN | _ | _ | _ | AVG GROSS MARGIN %
  //   4: values across — but here only every 4th col matters
  //   5: METRIC | weekly headers... | TOTAL / AVG | TREND
  //   6+: data rows
  const periodLine = rows[2]?.[0] ?? "";
  // Period text in cell 0 + portfolio text further along the same row
  const portfolio = (rows[2]?.find((c, i) => i > 0 && /portfolio/i.test(c)) ?? "").replace(/^\s*PORTFOLIO\s*·\s*/i, "").trim();
  const period = periodLine.replace(/^\s*PERIOD\s*·\s*/i, "").trim();
  const ytdValuesRow = rows[4] ?? [];
  // Pull avg cost per clean from the wide YTD row
  const avgCostPerClean = ytdValuesRow[12] ?? "";

  const headers = rows[5] ?? [];
  const dataRows = rows.slice(6).filter((r) => !r[0].toUpperCase().startsWith("METHODOLOGY"));
  return { period, portfolio, table: { headers, rows: dataRows }, avgCostPerClean };
}

function extractCostDetail(raw: string[][]): CleaningTable {
  const rows = clean(raw);
  // Layout: title (0), subtitle (1), header (2), data (3+)
  const headers = rows[2] ?? [];
  const dataRows = rows.slice(3);
  return { headers, rows: dataRows };
}

export async function fetchCleaningData(): Promise<CleaningData> {
  const [monthlyRaw, weeklyRaw, costDetailRaw] = await Promise.all([
    fetchSheet(SHEETS.monthly.gid),
    fetchSheet(SHEETS.weekly.gid),
    fetchSheet(SHEETS.costDetail.gid),
  ]);

  const m = extractMonthly(monthlyRaw);
  const w = extractWeekly(weeklyRaw);
  const cd = extractCostDetail(costDetailRaw);

  return {
    generatedAt: new Date().toISOString(),
    ytd: { ...m.ytd, avgCostPerClean: w.avgCostPerClean },
    period: { monthly: m.period, weekly: w.period, portfolio: w.portfolio },
    monthly: m.table,
    weekly: w.table,
    costDetail: cd,
  };
}
