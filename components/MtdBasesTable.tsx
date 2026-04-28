import type { PeriodBases, PeriodBasis } from "@/lib/aggregate";

const fmt = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Row = ({
  label, values, bold, tone,
}: {
  label: string;
  values: (string | number)[];
  bold?: boolean;
  tone?: "good" | "bad" | "muted";
}) => {
  const cell = bold ? "font-semibold" : "";
  const toneCls =
    tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : tone === "muted" ? "text-muted" : "text-text";
  return (
    <tr className="border-t border-border/60 transition-colors hover:bg-panel2/40">
      <td className={"py-2.5 text-text " + cell}>{label}</td>
      {values.map((v, i) => (
        <td key={i} className={"py-2.5 text-right tabular-nums " + cell + " " + toneCls}>
          {v}
        </td>
      ))}
    </tr>
  );
};

export function MtdBasesTable({ data }: { data: PeriodBases }) {
  const cols: PeriodBasis[] = [data.stayedNights, data.checkOut, data.checkIn];

  return (
    <section className="rounded-xl border border-border bg-panel p-6 shadow-soft">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
            Revenue bases
          </p>
          <h2 className="mt-1 text-base font-semibold tracking-tight text-text">
            {data.rangeLabel}
          </h2>
        </div>
        <span className="text-[11px] text-muted">
          {data.rangeStart} → {data.rangeEnd} · {data.daysInRange} days · occupancy{" "}
          <span className="text-text">{data.occupancyPct}%</span>{" "}
          ({data.stayedNights.nights} / {data.totalNightsAvailable} nights)
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-faint">
            <tr>
              <th className="pb-3 text-left  font-medium">&nbsp;</th>
              <th className="pb-3 text-right font-medium">
                <div className="text-text">Stayed-nights</div>
                <div className="text-[10px] normal-case text-faint">GAAP — recommended</div>
              </th>
              <th className="pb-3 text-right font-medium">
                <div className="text-text">Check-out</div>
                <div className="text-[10px] normal-case text-faint">bookings completed</div>
              </th>
              <th className="pb-3 text-right font-medium">
                <div className="text-text">Check-in</div>
                <div className="text-[10px] normal-case text-faint">bookings started</div>
              </th>
            </tr>
          </thead>
          <tbody>
            <Row label="Bookings"           values={cols.map((c) => c.bookings.toLocaleString())} tone="muted" />
            <Row label="Net Accommodation"  values={cols.map((c) => fmt(c.netAccommodation))} />
            <Row label="Cleaning Fare"      values={cols.map((c) => fmt(c.cleaningFare))} />
            <Row label="Other Fees"         values={cols.map((c) => fmt(c.otherFees))} />
            <Row label="Taxes"              values={cols.map((c) => fmt(c.taxes))} tone="muted" />
            <Row label="Gross Revenue"      values={cols.map((c) => fmt(c.grossRevenue))} bold />
            <Row label="Channel Commission" values={cols.map((c) => `${fmt(c.commission)} (${c.commissionPct}%)`)} tone="bad" />
            <Row label="Net Payout"         values={cols.map((c) => fmt(c.netPayout))} bold tone="good" />
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-[11px] text-muted">
        <strong className="text-text">Stayed-nights</strong> apportions revenue across the actual nights stayed within the period.
        {" "}<strong className="text-text">Check-out</strong> books each reservation in full when it ended.
        {" "}<strong className="text-text">Check-in</strong> books it when it began.
      </p>
    </section>
  );
}
