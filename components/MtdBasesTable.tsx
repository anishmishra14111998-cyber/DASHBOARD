import type { PeriodBases, PeriodBasis } from "@/lib/aggregate";

const fmt = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Row = ({
  label,
  values,
  bold,
  tone,
}: {
  label: string;
  values: (string | number)[];
  bold?: boolean;
  tone?: "good" | "bad" | "muted";
}) => {
  const cell = bold ? "font-semibold" : "";
  const toneCls =
    tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : tone === "muted" ? "text-muted" : "";
  return (
    <tr className="border-t border-border">
      <td className={`py-2 ${cell}`}>{label}</td>
      {values.map((v, i) => (
        <td key={i} className={`py-2 text-right ${cell} ${toneCls}`}>
          {v}
        </td>
      ))}
    </tr>
  );
};

export function MtdBasesTable({ data }: { data: PeriodBases }) {
  const cols: PeriodBasis[] = [data.stayedNights, data.checkOut, data.checkIn];

  return (
    <div className="rounded-xl border border-border bg-panel p-4">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          {data.rangeLabel} · 3 revenue bases
        </h2>
        <span className="text-xs text-muted">
          {data.rangeStart} → {data.rangeEnd} · {data.daysInRange} days · occupancy {data.occupancyPct}% (
          {data.stayedNights.nights} / {data.totalNightsAvailable} nights)
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-muted">
              <th className="py-2 text-left  font-normal">&nbsp;</th>
              <th className="py-2 text-right font-normal">
                <div>Stayed-nights</div>
                <div className="text-[10px] normal-case text-muted">GAAP — recommended</div>
              </th>
              <th className="py-2 text-right font-normal">
                <div>Check-out basis</div>
                <div className="text-[10px] normal-case text-muted">bookings completed</div>
              </th>
              <th className="py-2 text-right font-normal">
                <div>Check-in basis</div>
                <div className="text-[10px] normal-case text-muted">bookings started</div>
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
            <Row label="Channel Commission" values={cols.map((c) => `${fmt(c.commission)}  (${c.commissionPct}%)`)} tone="bad" />
            <Row label="Net Payout"         values={cols.map((c) => fmt(c.netPayout))} bold tone="good" />
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">
        <strong className="text-text">Stayed-nights</strong> apportions each reservation's revenue across the
        actual nights stayed within the period (recommended for revenue recognition).{" "}
        <strong className="text-text">Check-out</strong> books the full reservation in the period it ended.{" "}
        <strong className="text-text">Check-in</strong> books it in the period it began.
      </p>
    </div>
  );
}
