"use client";
import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import type { DailyPoint } from "@/lib/aggregate";

export function DailyChart({ data }: { data: DailyPoint[] }) {
  return (
    <section className="rounded-xl border border-border bg-panel p-6 shadow-soft">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
            Day-by-day
          </p>
          <h2 className="mt-1 text-base font-semibold tracking-tight text-text">
            Revenue, commission &amp; occupancy
          </h2>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-muted">
          <Legend2 dotClass="bg-accent" label="Gross" />
          <Legend2 dotClass="bg-bad/80" label="Commission" />
          <Legend2 dotClass="bg-good" label="Occupancy %" />
        </div>
      </div>
      <div className="h-[340px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#222633" strokeDasharray="2 6" vertical={false} />
            <XAxis
              dataKey="label"
              stroke="#5b6378"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              interval={2}
            />
            <YAxis
              yAxisId="left"
              stroke="#5b6378"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              width={50}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#5b6378"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              width={36}
            />
            <Tooltip
              contentStyle={{
                background: "#0f1117",
                border: "1px solid #363c50",
                borderRadius: 10,
                fontSize: 12,
                boxShadow: "0 8px 32px -8px rgba(0,0,0,0.6)",
              }}
              labelStyle={{ color: "#eef0f6", fontWeight: 600 }}
              formatter={(value: number, name: string) =>
                name === "Occupancy"
                  ? [`${value}%`, name]
                  : [`$${value.toLocaleString()}`, name]
              }
            />
            <Bar yAxisId="left" dataKey="revenue" name="Gross" fill="#6b8eff" radius={[3, 3, 0, 0]} />
            <Bar yAxisId="left" dataKey="commission" name="Commission" fill="#f43f5e" fillOpacity={0.7} radius={[3, 3, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="occupancyPct" name="Occupancy"
              stroke="#22c55e" strokeWidth={2.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function Legend2({ dotClass, label }: { dotClass: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={"h-2 w-2 rounded-full " + dotClass} />
      {label}
    </span>
  );
}
