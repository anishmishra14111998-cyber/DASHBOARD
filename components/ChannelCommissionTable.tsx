import type { ChannelCommissionPoint } from "@/lib/aggregate";

const labels: Record<ChannelCommissionPoint["channel"], string> = {
  "guesty-direct": "Direct",
  booking: "Booking.com",
  airbnb: "Airbnb",
  other: "Other",
};

const fmt = (n: number) =>
  `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export function ChannelCommissionTable({ data }: { data: ChannelCommissionPoint[] }) {
  const totals = data.reduce(
    (s, d) => ({
      bookings: s.bookings + d.bookings,
      gross: s.gross + d.gross,
      commission: s.commission + d.commission,
      net: s.net + d.net,
    }),
    { bookings: 0, gross: 0, commission: 0, net: 0 }
  );
  const totalCommissionPct = totals.gross > 0
    ? Math.round((totals.commission / totals.gross) * 1000) / 10
    : 0;

  return (
    <div className="rounded-xl border border-border bg-panel p-4">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
        Commission by channel
      </h2>
      <table className="w-full text-sm">
        <thead className="text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="py-2 text-left  font-normal">Channel</th>
            <th className="py-2 text-right font-normal">Bookings</th>
            <th className="py-2 text-right font-normal">Gross</th>
            <th className="py-2 text-right font-normal">Commission</th>
            <th className="py-2 text-right font-normal">Comm %</th>
            <th className="py-2 text-right font-normal">Net</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.channel} className="border-t border-border">
              <td className="py-2">{labels[d.channel]}</td>
              <td className="py-2 text-right text-muted">{d.bookings}</td>
              <td className="py-2 text-right">{fmt(d.gross)}</td>
              <td className="py-2 text-right text-bad">{fmt(d.commission)}</td>
              <td className="py-2 text-right text-muted">{d.commissionPct}%</td>
              <td className="py-2 text-right text-good">{fmt(d.net)}</td>
            </tr>
          ))}
          <tr className="border-t border-border font-medium">
            <td className="py-2">Total</td>
            <td className="py-2 text-right">{totals.bookings}</td>
            <td className="py-2 text-right">{fmt(totals.gross)}</td>
            <td className="py-2 text-right text-bad">{fmt(totals.commission)}</td>
            <td className="py-2 text-right text-muted">{totalCommissionPct}%</td>
            <td className="py-2 text-right text-good">{fmt(totals.net)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
