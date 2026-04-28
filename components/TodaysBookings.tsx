"use client";
import { useState } from "react";
import type { NewBookingToday } from "@/lib/aggregate";

const CH: Record<string, string> = {
  airbnb: "Airbnb", booking: "Booking.com", vrbo: "Vrbo",
  "guesty-direct": "Direct", other: "Other",
};

function fmtDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined,
    { month: "short", day: "numeric", timeZone: "UTC" });
}
const fmtMoney = (n: number) =>
  `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

interface Props {
  bookings: NewBookingToday[];
  paid: number;
}

export function TodaysBookings({ bookings, paid }: Props) {
  const [open, setOpen] = useState(false);
  const total = bookings.length;
  const unpaid = bookings.filter(b => !b.isPaid);

  if (total === 0) return null;

  return (
    <div>
      {/* ── Compact summary bar ── */}
      <div className={`flex flex-wrap items-center gap-x-5 gap-y-2 border border-border bg-panel px-4 py-3 shadow-soft transition-colors ${open ? "rounded-t-xl border-b-0" : "rounded-xl"}`}>
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
          New Bookings Today
        </span>

        <div className="flex items-center gap-1.5 text-sm">
          <span className="tabular-nums font-semibold text-text">{total}</span>
          <span className="text-muted">received</span>
        </div>

        <span className="text-border/60 select-none">·</span>

        <div className="flex items-center gap-1.5 text-sm">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-good">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span className="tabular-nums font-semibold text-good">{paid}</span>
          <span className="text-muted">paid</span>
        </div>

        {unpaid.length > 0 && (
          <>
            <span className="text-border/60 select-none">·</span>
            <button
              onClick={() => setOpen(o => !o)}
              className="flex items-center gap-1.5 rounded-lg border border-warn/30 bg-warn/5 px-2.5 py-1 text-xs font-medium text-warn transition-colors hover:bg-warn/10"
            >
              <span className="tabular-nums">{unpaid.length}</span>
              <span>pending payment</span>
              <svg
                width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                className={`transition-transform ${open ? "rotate-180" : ""}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* ── Expandable pending bookings ── */}
      {open && unpaid.length > 0 && (
        <div className="rounded-b-xl border border-t-0 border-warn/25 bg-warn/5 overflow-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-faint border-b border-warn/20">
                <th className="px-4 py-2.5 text-left font-medium">Channel</th>
                <th className="px-4 py-2.5 text-left font-medium">Property</th>
                <th className="px-4 py-2.5 text-left font-medium">Booking ID</th>
                <th className="px-4 py-2.5 text-right font-medium">Check-in</th>
                <th className="px-4 py-2.5 text-right font-medium">Check-out</th>
                <th className="px-4 py-2.5 text-right font-medium">Nights</th>
                <th className="px-4 py-2.5 text-right font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {unpaid.map((b) => (
                <tr key={b.id} className="border-t border-warn/10 hover:bg-warn/5 transition-colors">
                  <td className="px-4 py-2.5">
                    <span className="rounded-full border border-border bg-panel2 px-2 py-0.5 text-[11px] text-muted">
                      {CH[b.channel] ?? b.channel}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-text max-w-[180px] truncate">{b.propertyName}</td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-muted">{b.confirmationCode}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted">{fmtDate(b.checkIn)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted">{fmtDate(b.checkOut)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-text">{b.nights}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium text-text">{fmtMoney(b.grossRevenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
