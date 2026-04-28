import type { CleaningTable as TableData } from "@/lib/cleaning";

function isSectionHeader(row: string[]): boolean {
  if (!row[0]?.trim()) return false;
  const onlyFirst = row.slice(1).every((c) => !c?.trim());
  if (!onlyFirst) return false;
  return /[A-Z]/.test(row[0]);
}

function isSubTotalRow(label: string): boolean {
  return /sub-total|subtotal|^\s*total/i.test(label);
}

function isProfitRow(label: string): boolean {
  return /net profit|net p&l|profit \/ \(loss\)/i.test(label);
}

function isAnalyticsHeader(label: string): boolean {
  return /margin %|cost per clean|revenue per clean|margin per clean/i.test(label);
}

function valueClass(value: string): string {
  const v = value.trim();
  if (!v || v === "-" || v === "—") return "text-faint";
  if (v.startsWith("(") && v.endsWith(")")) return "text-bad";
  if (v.startsWith("↓")) return "text-bad";
  if (v.startsWith("↑")) return "text-good";
  return "text-text";
}

function isMoney(v: string): boolean {
  return /^\(?\$/.test(v.trim());
}

export function CleaningTable({ data }: { data: TableData }) {
  const { headers, rows } = data;

  return (
    <div className="overflow-auto rounded-xl border border-border bg-panel shadow-soft">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="sticky top-0 z-10 bg-panel/95 backdrop-blur">
          <tr className="text-[11px] uppercase tracking-wider text-faint">
            {headers.map((h, i) => (
              <th
                key={i}
                className={
                  "border-b border-border px-3 py-3 font-medium " +
                  (i === 0 ? "text-left" : "text-right")
                }
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rIdx) => {
            const label = row[0] ?? "";
            const section = isSectionHeader(row);
            const subTotal = isSubTotalRow(label);
            const profit = isProfitRow(label);

            if (section) {
              return (
                <tr key={rIdx} className="bg-panel2/40">
                  <td
                    colSpan={headers.length}
                    className="border-t border-border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent"
                  >
                    {label.trim()}
                  </td>
                </tr>
              );
            }

            return (
              <tr
                key={rIdx}
                className={
                  "border-t border-border/40 transition-colors " +
                  (profit
                    ? "bg-bad/5 font-semibold"
                    : subTotal
                    ? "bg-panel2/30 font-semibold"
                    : "hover:bg-panel2/30")
                }
              >
                {row.map((cell, cIdx) => {
                  const v = cell ?? "";
                  const isLabelCol = cIdx === 0;
                  return (
                    <td
                      key={cIdx}
                      className={
                        "px-3 py-2 " +
                        (isLabelCol
                          ? "whitespace-nowrap text-text"
                          : "text-right whitespace-nowrap tabular-nums " + valueClass(v) +
                              (isMoney(v) ? " font-mono" : ""))
                      }
                    >
                      {isLabelCol ? (
                        <span className={isAnalyticsHeader(label) ? "text-muted" : ""}>{v.trim()}</span>
                      ) : (
                        v.trim() || <span className="text-faint">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
