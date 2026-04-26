import type { NextMonthForecast } from "@/lib/aggregate";

const fmtMoney = (n: number) =>
  `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

// Heuristic pacing read for hospitality: <20% by 30 days out is typically a red flag.
function pacingTone(pct: number): { label: string; cls: string } {
  if (pct >= 50) return { label: "strong pace", cls: "text-good" };
  if (pct >= 30) return { label: "healthy pace", cls: "text-text" };
  if (pct >= 15) return { label: "build phase",  cls: "text-muted" };
  return { label: "slow pace", cls: "text-bad" };
}

export function NextMonthForecastPanel({ data }: { data: NextMonthForecast }) {
  const tone = pacingTone(data.occupancyPct);

  return (
    <section className="rounded-2xl border border-border bg-gradient-to-br from-panel via-panel to-panel2/40 p-5 shadow-lg shadow-black/20">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Next Month Forecast
          </h2>
          <p className="mt-1 text-lg font-semibold text-text">
            {data.monthLabel}
          </p>
        </div>
        <div className="text-xs text-muted">
          {data.start} → {data.end} · {data.daysInMonth} days · {data.totalProperties} properties
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Booked Revenue"
          value={fmtMoney(data.bookedRevenue)}
          sub={`${fmtMoney(data.bookedNetPayout)} net · ${fmtMoney(data.bookedCommission)} commission`}
          accent
        />
        <Stat
          label="Forecasted Occupancy"
          value={`${data.occupancyPct}%`}
          sub={`${data.occupiedNights.toLocaleString()} / ${data.totalNightsAvailable.toLocaleString()} nights · ${tone.label}`}
          toneCls={tone.cls}
        />
        <Stat
          label="Confirmed Bookings"
          value={data.bookings.toLocaleString()}
          sub="reservations on the books"
        />
        <Stat
          label="ADR"
          value={fmtMoney(data.adr)}
          sub="gross / occupied night"
        />
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
  toneCls,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  toneCls?: string;
}) {
  return (
    <div
      className={
        "rounded-xl border p-4 " +
        (accent
          ? "border-accent/40 bg-accent/5"
          : "border-border bg-panel2/60")
      }
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </div>
      <div className={"mt-1 text-2xl font-semibold " + (toneCls ?? "text-text")}>
        {value}
      </div>
      {sub && <div className="mt-1 text-[11px] text-muted">{sub}</div>}
    </div>
  );
}
