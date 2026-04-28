import type { ChannelCommissionPoint } from "@/lib/aggregate";

const labels: Record<ChannelCommissionPoint["channel"], string> = {
  "guesty-direct": "Direct",
  booking: "Booking.com",
  airbnb: "Airbnb",
  vrbo: "Vrbo",
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
    <section className="rounded-xl border border-border bg-panel p-6 shadow-soft">
      <h2 className="mb-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
        Commission by channel
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-faint">
            <tr>
              <th className="pb-3 text-left  font-medium">Channel</th>
              <th className="pb-3 text-right font-medium">Bookings</th>
              <th className="pb-3 text-right font-medium">Gross</th>
              <th className="pb-3 text-right font-medium">Commission</th>
              <th className="pb-3 text-right font-medium">Comm %</th>
              <th className="pb-3 text-right font-medium">Net</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.channel} className="border-t border-border/60 transition-colors hover:bg-panel2/40">
                <td className="py-2.5 text-text">{labels[d.channel]}</td>
                <td className="py-2.5 text-right tabular-nums text-muted">{d.bookings}</td>
                <td className="py-2.5 text-right tabular-nums">{fmt(d.gross)}</td>
                <td className="py-2.5 text-right tabular-nums text-bad">{fmt(d.commission)}</td>
                <td className="py-2.5 text-right tabular-nums text-muted">{d.commissionPct}%</td>
                <td className="py-2.5 text-right tabular-nums text-good">{fmt(d.net)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-border bg-panel2/30 font-semibold">
              <td className="py-3 text-text">Total</td>
              <td className="py-3 text-right tabular-nums">{totals.bookings}</td>
              <td className="py-3 text-right tabular-nums">{fmt(totals.gross)}</td>
              <td className="py-3 text-right tabular-nums text-bad">{fmt(totals.commission)}</td>
              <td className="py-3 text-right tabular-nums text-muted">{totalCommissionPct}%</td>
              <td className="py-3 text-right tabular-nums text-good">{fmt(totals.net)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
