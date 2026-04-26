"use client";
import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import type { DailyPoint } from "@/lib/aggregate";

export function DailyChart({ data }: { data: DailyPoint[] }) {
  return (
    <div className="rounded-xl border border-border bg-panel p-4">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Day-by-day · last 30 days
        </h2>
        <span className="text-xs text-muted">revenue $ &nbsp;·&nbsp; occupancy %</span>
      </div>
      <div className="h-[340px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#262b36" strokeDasharray="3 3" />
            <XAxis dataKey="label" stroke="#8a93a6" fontSize={11} interval={2} />
            <YAxis yAxisId="left" stroke="#8a93a6" fontSize={11}
              tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} />
            <YAxis yAxisId="right" orientation="right" stroke="#8a93a6" fontSize={11}
              domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <Tooltip
              contentStyle={{ background: "#12151c", border: "1px solid #262b36", borderRadius: 8 }}
              labelStyle={{ color: "#e6e9f0" }}
              formatter={(value: number, name: string) =>
                name === "Occupancy"
                  ? [`${value}%`, name]
                  : [`$${value.toLocaleString()}`, name]
              }
            />
            <Legend wrapperStyle={{ color: "#8a93a6", fontSize: 12 }} />
            <Bar yAxisId="left" dataKey="revenue" name="Gross Revenue" fill="#5b8cff" radius={[3, 3, 0, 0]} />
            <Bar yAxisId="left" dataKey="commission" name="Commission" fill="#ff6b6b" radius={[3, 3, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="occupancyPct" name="Occupancy"
              stroke="#33c48d" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
