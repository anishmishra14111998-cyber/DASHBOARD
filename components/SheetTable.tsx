import type { ParsedSheet } from "@/lib/excel";

export function SheetTable({ sheet }: { sheet: ParsedSheet }) {
  return (
    <div className="overflow-auto rounded-xl border border-border bg-panel">
      <table className="w-full border-collapse text-sm">
        <tbody>
          {sheet.rows.map((row, rIdx) => (
            <tr key={rIdx}>
              {row.map((cell, cIdx) => {
                if (cell.hideInMerge) return null;
                const style: React.CSSProperties = {};
                if (cell.bg) style.backgroundColor = cell.bg;
                if (cell.color) style.color = cell.color;
                if (cell.bold) style.fontWeight = 600;
                if (cell.align) style.textAlign = cell.align;
                return (
                  <td
                    key={cIdx}
                    rowSpan={cell.rowSpan}
                    colSpan={cell.colSpan}
                    style={style}
                    className="border border-border/50 px-2 py-1 align-top"
                  >
                    {cell.value}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
