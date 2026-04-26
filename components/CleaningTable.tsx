import type { CleaningTable as TableData } from "@/lib/cleaning";

// Heuristics to style the dashboard tables as the original Excel does.
function isSectionHeader(row: string[]): boolean {
  // Section headers: only the first cell has content, and it usually starts with a leading space + ALL CAPS.
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
  if (!v || v === "-" || v === "—") return "text-muted";
  if (v.startsWith("(") && v.endsWith(")")) return "text-bad";       // negative / loss
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
    <div className="overflow-auto rounded-2xl border border-border bg-panel">
      <table className="w-full min-w-[900px] border-collapse text-sm">
        <thead className="sticky top-0 bg-panel2/95 backdrop-blur">
          <tr className="text-xs uppercase tracking-wider text-muted">
            {headers.map((h, i) => (
              <th
                key={i}
                className={
                  "border-b border-border px-3 py-2 font-medium " +
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
                <tr key={rIdx} className="bg-panel2/50">
                  <td
                    colSpan={headers.length}
                    className="border-t border-border px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent"
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
                  "border-t border-border/60 " +
                  (profit
                    ? "bg-bad/10 font-semibold"
                    : subTotal
                    ? "bg-panel2/40 font-semibold"
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
                        "px-3 py-1.5 " +
                        (isLabelCol
                          ? "whitespace-nowrap text-text"
                          : "text-right whitespace-nowrap " + valueClass(v) +
                              (isMoney(v) ? " font-mono" : ""))
                      }
                    >
                      {isLabelCol ? (
                        <span className={isAnalyticsHeader(label) ? "text-muted" : ""}>{v.trim()}</span>
                      ) : (
                        v.trim() || "—"
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
