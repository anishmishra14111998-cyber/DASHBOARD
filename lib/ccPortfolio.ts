const SHEET_ID = "1FkVwnC7cQiNMbPzuaDwrqWcW1RMEkEkLs9YiXJCrWCU";
const GID = "560201121";

function csvUrl() {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;
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

export interface CCUnitRow {
  property: string;
  unit: string;
  janGross: number; janFees: number; janNet: number;
  febGross: number; febFees: number; febNet: number;
  marGross: number; marFees: number; marNet: number;
  threeMonthGross: number;
  threeMonthFees: number;
  threeMonthNet: number;
}

export interface CCPropertyGroup {
  name: string;
  units: CCUnitRow[];
  threeMonthGross: number;
  threeMonthFees: number;
  threeMonthNet: number;
  feeRatePct: number;
}

export interface CCMonthSummary {
  month: string;
  gross: number;
  fees: number;
  net: number;
}

export interface CCPortfolioData {
  generatedAt: string;
  threeMonth: {
    gross: number;
    fees: number;
    net: number;
    unitCount: number;
    propertyCount: number;
  };
  months: [CCMonthSummary, CCMonthSummary, CCMonthSummary];
  properties: CCPropertyGroup[];
}

export async function fetchCCPortfolioData(): Promise<CCPortfolioData> {
  const res = await fetch(csvUrl(), { cache: "no-store" });
  if (!res.ok) throw new Error(`CC Portfolio sheet fetch failed: ${res.status}`);
  const rows = parseCsv(await res.text());

  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if ((rows[i]?.[0] ?? "").trim() === "Property") { headerIdx = i; break; }
  }

  const unitRows: CCUnitRow[] = [];
  if (headerIdx >= 0) {
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i] ?? [];
      const name = (row[0] ?? "").trim();
      if (!name || name.toUpperCase().startsWith("CC PORTFOLIO TOTAL")) break;

      unitRows.push({
        property: name,
        unit: (row[1] ?? "").trim(),
        janGross: money(row[2]),  janFees: money(row[3]),  janNet: money(row[4]),
        febGross: money(row[5]),  febFees: money(row[6]),  febNet: money(row[7]),
        marGross: money(row[8]),  marFees: money(row[9]),  marNet: money(row[10]),
        threeMonthGross: money(row[2]) + money(row[5]) + money(row[8]),
        threeMonthFees:  money(row[3]) + money(row[6]) + money(row[9]),
        threeMonthNet:   money(row[4]) + money(row[7]) + money(row[10]),
      });
    }
  }

  // Group by property name
  const groupMap = new Map<string, CCUnitRow[]>();
  for (const u of unitRows) {
    if (!groupMap.has(u.property)) groupMap.set(u.property, []);
    groupMap.get(u.property)!.push(u);
  }

  const properties: CCPropertyGroup[] = Array.from(groupMap.entries())
    .map(([name, units]) => {
      const gross = units.reduce((s, u) => s + u.threeMonthGross, 0);
      const fees  = units.reduce((s, u) => s + u.threeMonthFees, 0);
      const net   = units.reduce((s, u) => s + u.threeMonthNet, 0);
      return {
        name, units,
        threeMonthGross: gross,
        threeMonthFees: fees,
        threeMonthNet: net,
        feeRatePct: gross > 0 ? Math.round((Math.abs(fees) / gross) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => b.threeMonthNet - a.threeMonthNet);

  const sum = (fn: (u: CCUnitRow) => number) => unitRows.reduce((s, u) => s + fn(u), 0);

  const janGross = sum(u => u.janGross), janFees = sum(u => u.janFees), janNet = sum(u => u.janNet);
  const febGross = sum(u => u.febGross), febFees = sum(u => u.febFees), febNet = sum(u => u.febNet);
  const marGross = sum(u => u.marGross), marFees = sum(u => u.marFees), marNet = sum(u => u.marNet);

  return {
    generatedAt: new Date().toISOString(),
    threeMonth: {
      gross: janGross + febGross + marGross,
      fees:  janFees  + febFees  + marFees,
      net:   janNet   + febNet   + marNet,
      unitCount: unitRows.length,
      propertyCount: properties.length,
    },
    months: [
      { month: "Jan 2026", gross: janGross, fees: janFees, net: janNet },
      { month: "Feb 2026", gross: febGross, fees: febFees, net: febNet },
      { month: "Mar 2026", gross: marGross, fees: marFees, net: marNet },
    ],
    properties,
  };
}
