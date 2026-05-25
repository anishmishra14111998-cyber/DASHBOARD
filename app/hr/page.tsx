"use client";
import { useEffect, useState } from "react";
import type { AttendanceUserSummary } from "@/app/api/hr/attendance/route";

interface Data {
  generatedAt: string;
  today: string;
  weekStart: string;
  users: AttendanceUserSummary[];
}

const REFRESH_MS = 60 * 1000;

const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "—";

function liveDuration(since: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(since).getTime()) / 60000));
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function HrDashboardPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);

  async function load() {
    try {
      const res = await fetch("/api/hr/attendance", { cache: "no-store" });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      setData(await res.json());
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => { clearInterval(id); clearInterval(t); };
  }, []);

  if (error) {
    return (
      <main className="mx-auto max-w-7xl p-8">
        <div className="rounded-xl border border-bad/40 bg-bad/5 p-5 text-bad">Failed to load attendance: {error}</div>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-10">
        <div className="skeleton h-10 w-72" />
        <div className="skeleton h-64" />
      </main>
    );
  }

  const onNow = data.users.filter((u) => u.checkedIn).length;
  const teamWeek = data.users.reduce((s, u) => s + u.weekHours, 0);
  const teamToday = data.users.reduce((s, u) => s + u.todayHours, 0);

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-6 py-10 animate-fade-in">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">HR · Attendance</p>
          <h1 className="mt-2 text-display-lg tracking-tight text-text">Team Time Clock</h1>
          <p className="mt-1.5 text-sm text-muted">
            Live check-in / check-out · auto-refresh 1 min ·{" "}
            <span className="text-text">{new Date(data.generatedAt).toLocaleTimeString()}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted">
          <span>Employee check-in link:</span>
          <code className="rounded bg-panel2 px-2 py-1 text-text">/timeclock</code>
        </div>
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi label="On the Clock Now" value={`${onNow}`} sub={`of ${data.users.length} staff`} tone={onNow > 0 ? "good" : "default"} />
        <Kpi label="Hours Today" value={teamToday.toFixed(1)} sub="team total" tone="accent" />
        <Kpi label="Hours This Week" value={teamWeek.toFixed(1)} sub={`since ${data.weekStart}`} />
        <Kpi label="Staff" value={`${data.users.length}`} sub="active employees" />
      </section>

      {/* Table */}
      <section className="overflow-hidden rounded-xl border border-border bg-panel shadow-soft">
        <div className="overflow-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-panel/95 text-[11px] uppercase tracking-wider text-faint">
              <tr>
                <th className="border-b border-border px-4 py-3 text-left font-medium">Employee</th>
                <th className="border-b border-border px-4 py-3 text-left font-medium">Status</th>
                <th className="border-b border-border px-4 py-3 text-left font-medium">Checked In</th>
                <th className="border-b border-border px-4 py-3 text-left font-medium">Checked Out</th>
                <th className="border-b border-border px-4 py-3 text-right font-medium">Today</th>
                <th className="border-b border-border px-4 py-3 text-right font-medium">This Week</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => {
                const last = u.todayRecords[0];
                return (
                  <tr key={u.id} className="border-t border-border/40 transition-colors hover:bg-panel2/50">
                    <td className="px-4 py-3 font-medium text-text">{u.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        u.checkedIn ? "bg-good/10 text-good" : "bg-panel2 text-muted"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${u.checkedIn ? "bg-good animate-pulse" : "bg-muted"}`} />
                        {u.checkedIn ? `In · ${liveDuration(u.since!)}` : "Out"}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted">{fmtTime(last?.checkInAt ?? u.since)}</td>
                    <td className="px-4 py-3 tabular-nums text-muted">
                      {u.checkedIn ? <span className="text-good">in progress</span> : fmtTime(u.lastCheckOut)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-text">{u.todayHours.toFixed(2)}h</td>
                    <td className="px-4 py-3 text-right tabular-nums text-text">{u.weekHours.toFixed(2)}h</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "default" | "good" | "accent" }) {
  const valCls = tone === "good" ? "text-good" : tone === "accent" ? "text-accent" : "text-text";
  const bar = tone === "good" ? "bg-good" : tone === "accent" ? "bg-accent" : "bg-borderStrong";
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-panel p-5 shadow-soft">
      <div className={"absolute inset-x-0 top-0 h-px opacity-50 " + bar} />
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</div>
      <div className={"mt-2 text-display tabular-nums font-semibold " + valCls}>{value}</div>
      {sub && <div className="mt-1.5 text-[11px] text-muted">{sub}</div>}
    </div>
  );
}
