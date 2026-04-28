"use client";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import type { MonthSummary } from "@/lib/grossMargin";

const fmtK = (n: number) => `$${(n / 1000).toFixed(0)}K`;

const MONTH_COLOR: Record<string, string> = {
  "Jan 2026": "#5b8cff",
  "Feb 2026": "#818cf8",
  "Mar 2026": "#34d399",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const net = payload.find((p: { dataKey: string }) => p.dataKey === "netRevenue")?.value ?? 0;
  const gm1 = payload.find((p: { dataKey: string }) => p.dataKey === "gm1")?.value ?? 0;
  const marginPct = payload.find((p: { dataKey: string }) => p.dataKey === "marginPct")?.value ?? 0;
  return (
    <div className="rounded-xl border border-border bg-panel p-4 text-xs shadow-xl space-y-2 min-w-[180px]">
      <p className="font-semibold text-text">{label}</p>
      <div className="space-y-1.5">
        <div className="flex justify-between gap-6">
          <span className="text-muted">Net Revenue</span>
          <span className="tabular-nums text-text">${net.toLocaleString()}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-muted">GM1</span>
          <span className={`tabular-nums font-semibold ${gm1 >= 0 ? "text-good" : "text-bad"}`}>
            {gm1 >= 0 ? "$" : "($"}{Math.abs(gm1).toLocaleString()}{gm1 < 0 ? ")" : ""}
          </span>
        </div>
        <div className="mt-2 flex justify-between gap-6 border-t border-border pt-2">
          <span className="text-muted">Margin</span>
          <span className={`tabular-nums font-bold ${marginPct >= 30 ? "text-good" : marginPct >= 10 ? "text-warn" : "text-bad"}`}>
            {marginPct}%
          </span>
        </div>
      </div>
    </div>
  );
}

export function GrossMarginChart({ months }: { months: MonthSummary[] }) {
  const data = months.map(m => ({
    month: m.month.replace(" 2026", ""),
    fullMonth: m.month,
    netRevenue: m.netRevenue,
    gm1: m.gm1,
    marginPct: m.marginPct,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 10, right: 48, left: 8, bottom: 0 }} barGap={4} barCategoryGap="35%">
        <CartesianGrid vertical={false} stroke="#1a2035" strokeDasharray="3 3" />
        <XAxis
          dataKey="month"
          tick={{ fill: "#6b7280", fontSize: 12, fontWeight: 500 }}
          axisLine={false} tickLine={false}
        />
        <YAxis
          yAxisId="money"
          tickFormatter={fmtK}
          tick={{ fill: "#6b7280", fontSize: 10 }}
          axisLine={false} tickLine={false} width={52}
        />
        <YAxis
          yAxisId="pct"
          orientation="right"
          tickFormatter={v => `${v}%`}
          tick={{ fill: "#6b7280", fontSize: 10 }}
          axisLine={false} tickLine={false} width={44}
          domain={[0, 60]}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(91,140,255,0.06)" }} />
        <ReferenceLine yAxisId="money" y={0} stroke="#252c3f" strokeWidth={1} />

        {/* Net Revenue — faint fill */}
        <Bar yAxisId="money" dataKey="netRevenue" name="Net Revenue" radius={[5, 5, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.month} fill={MONTH_COLOR[d.fullMonth] ?? "#5b8cff"} opacity={0.2} />
          ))}
        </Bar>

        {/* GM1 — solid fill */}
        <Bar yAxisId="money" dataKey="gm1" name="GM1" radius={[5, 5, 0, 0]}>
          {data.map((d) => (
            <Cell
              key={d.month}
              fill={d.gm1 >= 0 ? MONTH_COLOR[d.fullMonth] ?? "#34d399" : "#f87171"}
            />
          ))}
        </Bar>

        {/* Margin % line */}
        <Line
          yAxisId="pct"
          type="monotone"
          dataKey="marginPct"
          stroke="#fbbf24"
          strokeWidth={2.5}
          dot={{ fill: "#fbbf24", r: 5, strokeWidth: 2, stroke: "#08090d" }}
          activeDot={{ r: 7 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
