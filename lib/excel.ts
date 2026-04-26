// Browser-side Excel parser. exceljs is a heavy dependency (~300KB), so we
// dynamic-import it inside loadWorkbook to keep the main bundle slim.
export interface ParsedCell {
  value: string;
  bold?: boolean;
  bg?: string;          // CSS color
  color?: string;       // CSS color
  align?: "left" | "right" | "center";
  isNumber?: boolean;
  isMerged?: boolean;
  // For the top-left cell of a merge: how many rows/cols it spans
  rowSpan?: number;
  colSpan?: number;
  // For non-anchor cells inside a merge, we omit them at render time
  hideInMerge?: boolean;
}

export interface ParsedSheet {
  name: string;
  rows: ParsedCell[][];
  colCount: number;
}

export interface ParsedWorkbook {
  sheets: ParsedSheet[];
}

// Excel ARGB looks like "FFRRGGBB" — convert to a CSS hex.
function argbToCss(argb: unknown): string | undefined {
  if (typeof argb !== "string" || argb.length !== 8) return undefined;
  return "#" + argb.slice(2);
}

// Excel theme colors aren't always trivial — fall back undefined when missing.
type ColorLike = { argb?: string } | undefined;

function readColor(c: ColorLike): string | undefined {
  return argbToCss(c?.argb);
}

function coerceValue(v: unknown): { display: string; isNumber: boolean } {
  if (v === null || v === undefined) return { display: "", isNumber: false };
  if (typeof v === "number") return { display: String(v), isNumber: true };
  if (typeof v === "boolean") return { display: v ? "TRUE" : "FALSE", isNumber: false };
  if (v instanceof Date) return { display: v.toISOString().slice(0, 10), isNumber: false };

  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("richText" in o && Array.isArray(o.richText)) {
      return { display: o.richText.map((r: { text?: string }) => r.text ?? "").join(""), isNumber: false };
    }
    if ("text" in o && typeof o.text === "string") return { display: o.text, isNumber: false };
    if ("result" in o) return coerceValue(o.result);
    if ("formula" in o) return { display: `=${o.formula}`, isNumber: false };
    if ("error" in o && typeof o.error === "string") return { display: o.error, isNumber: false };
  }
  return { display: String(v), isNumber: false };
}

export async function loadWorkbook(file: File): Promise<ParsedWorkbook> {
  const ExcelJS = (await import("exceljs")).default;
  const buffer = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const sheets: ParsedSheet[] = [];

  wb.eachSheet((sheet) => {
    const rowCount = sheet.actualRowCount || sheet.rowCount;
    const colCount = sheet.actualColumnCount || sheet.columnCount;

    // Initialize empty grid
    const grid: ParsedCell[][] = Array.from({ length: rowCount }, () =>
      Array.from({ length: colCount }, () => ({ value: "" }))
    );

    // Fill cells
    sheet.eachRow({ includeEmpty: true }, (row, rowIdx) => {
      if (rowIdx > rowCount) return;
      row.eachCell({ includeEmpty: true }, (cell, colIdx) => {
        if (colIdx > colCount) return;
        const r = rowIdx - 1;
        const c = colIdx - 1;
        if (r < 0 || c < 0) return;

        const { display, isNumber } = coerceValue(cell.value);
        const fill = (cell.fill as { fgColor?: ColorLike } | undefined)?.fgColor;
        const font = cell.font as { bold?: boolean; color?: ColorLike } | undefined;

        grid[r][c] = {
          value: display,
          bold: font?.bold || undefined,
          bg: readColor(fill),
          color: readColor(font?.color),
          align:
            cell.alignment?.horizontal === "right"  ? "right"
          : cell.alignment?.horizontal === "center" ? "center"
          : isNumber ? "right"
          : "left",
          isNumber,
        };
      });
    });

    // Merged cells: ExcelJS stores them as "A1:C2" strings on sheet.model.merges (varies by version).
    // The cleaner API: iterate sheet.eachRow, check cell.isMerged, sheet.getCell().master gives anchor.
    // We compute spans from sheet.model.merges if present.
    type MergeShape = { merges?: string[] };
    const merges = (sheet.model as MergeShape).merges ?? [];
    for (const range of merges) {
      // Range like "A1:C2"
      const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(range);
      if (!m) continue;
      const [, c1, r1s, c2, r2s] = m;
      const colA = colLettersToIndex(c1);
      const colB = colLettersToIndex(c2);
      const r1 = Number(r1s) - 1;
      const r2 = Number(r2s) - 1;
      if (r1 < 0 || colA < 0) continue;

      // Anchor (top-left)
      if (grid[r1] && grid[r1][colA]) {
        grid[r1][colA].isMerged = true;
        grid[r1][colA].rowSpan = r2 - r1 + 1;
        grid[r1][colA].colSpan = colB - colA + 1;
      }
      // Hide other cells in the merge
      for (let rr = r1; rr <= r2; rr++) {
        for (let cc = colA; cc <= colB; cc++) {
          if (rr === r1 && cc === colA) continue;
          if (grid[rr] && grid[rr][cc]) grid[rr][cc].hideInMerge = true;
        }
      }
    }

    sheets.push({ name: sheet.name, rows: grid, colCount });
  });

  return { sheets };
}

function colLettersToIndex(letters: string): number {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}
