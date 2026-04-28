import type { NextMonthForecast } from "@/lib/aggregate";

const fmtMoney = (n: number) =>
  `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

function pacingTone(pct: number): { label: string; cls: string; bar: string } {
  if (pct >= 50) return { label: "strong pace",  cls: "text-good", bar: "bg-good" };
  if (pct >= 30) return { label: "healthy pace", cls: "text-text", bar: "bg-accent" };
  if (pct >= 15) return { label: "build phase",  cls: "text-muted", bar: "bg-borderStrong" };
  return                   { label: "slow pace",    cls: "text-bad",  bar: "bg-bad" };
}

export function NextMonthForecastPanel({ data }: { data: NextMonthForecast }) {
  const tone = pacingTone(data.occupancyPct);
  const occWidth = Math.max(2, Math.min(100, data.occupancyPct));

  return (
    <section className="relative overflow-hidden rounded-xl border border-border bg-panel p-6 shadow-soft">
      {/* subtle accent ribbon at top */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />

      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
            Next month forecast
          </p>
          <h2 className="mt-1 text-display tracking-tight text-text">{data.monthLabel}</h2>
        </div>
        <div className="text-[11px] text-muted">
          {data.start} → {data.end} · {data.daysInMonth} days · {data.totalProperties} properties
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Booked Revenue" value={fmtMoney(data.bookedRevenue)}
              sub={`${fmtMoney(data.bookedNetPayout)} net · ${fmtMoney(data.bookedCommission)} comm.`} accent />
        <div className="rounded-lg border border-border bg-panel2/40 p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
            Forecasted Occupancy
          </div>
          <div className={"mt-2 text-display tabular-nums font-semibold " + tone.cls}>
            {data.occupancyPct}%
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-panel3">
            <div className={"h-full rounded-full " + tone.bar} style={{ width: `${occWidth}%` }} />
          </div>
          <div className="mt-1.5 text-[11px] text-muted">
            {data.occupiedNights.toLocaleString()} / {data.totalNightsAvailable.toLocaleString()} nights · {tone.label}
          </div>
        </div>
        <Stat label="Confirmed Bookings" value={data.bookings.toLocaleString()} sub="reservations on the books" />
        <Stat label="ADR" value={fmtMoney(data.adr)} sub="gross / occupied night" />
      </div>
    </section>
  );
}

function Stat({
  label, value, sub, accent,
}: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={"rounded-lg border p-4 " + (accent ? "border-accent/40 bg-accentSoft/40" : "border-border bg-panel2/40")}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
        {label}
      </div>
      <div className={"mt-2 text-display tabular-nums font-semibold " + (accent ? "text-text" : "text-text")}>
        {value}
      </div>
      {sub && <div className="mt-1.5 text-[11px] text-muted">{sub}</div>}
    </div>
  );
}
