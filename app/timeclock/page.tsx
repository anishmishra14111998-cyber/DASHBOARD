"use client";
import { useEffect, useState } from "react";
import type { AttendanceRecord } from "@/lib/attendance";

interface Me {
  user: { id: string; name: string } | null;
  checkedIn: boolean;
  since: string | null;
  recent: AttendanceRecord[];
}

const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "—";
const fmtDate = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

function duration(checkIn: string, checkOut: string | null): string {
  const end = checkOut ? new Date(checkOut).getTime() : Date.now();
  const mins = Math.max(0, Math.round((end - new Date(checkIn).getTime()) / 60000));
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function TimeclockPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [, setTick] = useState(0); // re-render so the live timer updates

  async function loadMe() {
    setLoading(true);
    try {
      const res = await fetch("/api/hr/me", { cache: "no-store" });
      if (res.ok) setMe(await res.json());
      else setMe({ user: null, checkedIn: false, since: null, recent: [] });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadMe(); }, []);
  // Tick every 30s so the "clocked in for Xh Ym" stays current.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/hr/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, password }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Login failed"); return; }
      setPassword("");
      await loadMe();
    } finally { setBusy(false); }
  }

  async function clock(action: "in" | "out") {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/hr/clock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Something went wrong"); return; }
      await loadMe();
    } finally { setBusy(false); }
  }

  async function logout() {
    await fetch("/api/hr/logout", { method: "POST" });
    setMe({ user: null, checkedIn: false, since: null, recent: [] });
    setId("");
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center p-6">
        <div className="skeleton h-40 w-full rounded-2xl" />
      </main>
    );
  }

  // ---- Login screen ----
  if (!me?.user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
        <div className="mb-8 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">Coveted Hospitality</p>
          <h1 className="mt-2 font-serif text-3xl tracking-tight text-text">Time Clock</h1>
          <p className="mt-1 text-sm text-muted">Sign in to check in or out</p>
        </div>
        <form onSubmit={login} className="space-y-3 rounded-2xl border border-border bg-panel p-6 shadow-soft">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted">Employee ID</label>
            <input
              value={id} onChange={(e) => setId(e.target.value)} autoCapitalize="none" autoCorrect="off"
              placeholder="e.g. ricky"
              className="w-full rounded-lg border border-border bg-panel2 px-3 py-2.5 text-text placeholder:text-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted">Password</label>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-border bg-panel2 px-3 py-2.5 text-text placeholder:text-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40"
            />
          </div>
          {error && <p className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}
          <button
            type="submit" disabled={busy}
            className="w-full rounded-lg bg-accent px-4 py-3 font-semibold text-white shadow-soft transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </main>
    );
  }

  // ---- Clocked-in / out screen ----
  const { user, checkedIn, since, recent } = me;
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">Coveted Hospitality</p>
          <h1 className="mt-1 font-serif text-2xl tracking-tight text-text">Hi, {user.name.split(" ")[0]}</h1>
        </div>
        <button onClick={logout} className="text-xs text-muted underline-offset-2 hover:text-text hover:underline">Sign out</button>
      </div>

      {/* Status + big action button */}
      <div className="mt-8 rounded-2xl border border-border bg-panel p-6 text-center shadow-soft">
        <div className={`mx-auto mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
          checkedIn ? "bg-good/10 text-good" : "bg-panel2 text-muted"
        }`}>
          <span className={`h-2 w-2 rounded-full ${checkedIn ? "bg-good animate-pulse" : "bg-muted"}`} />
          {checkedIn ? "Clocked in" : "Clocked out"}
        </div>

        {checkedIn && since && (
          <p className="mb-6 text-sm text-muted">
            Since <span className="text-text">{fmtTime(since)}</span> · <span className="tabular-nums text-text">{duration(since, null)}</span>
          </p>
        )}
        {!checkedIn && <p className="mb-6 text-sm text-muted">Ready when you are.</p>}

        {error && <p className="mb-4 rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}

        {checkedIn ? (
          <button
            onClick={() => clock("out")} disabled={busy}
            className="w-full rounded-xl bg-bad px-4 py-5 text-lg font-bold text-white shadow-soft transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "…" : "Check Out"}
          </button>
        ) : (
          <button
            onClick={() => clock("in")} disabled={busy}
            className="w-full rounded-xl bg-good px-4 py-5 text-lg font-bold text-white shadow-soft transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "…" : "Check In"}
          </button>
        )}
      </div>

      {/* Recent history */}
      {recent.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Recent</h2>
          <div className="overflow-hidden rounded-xl border border-border bg-panel shadow-soft">
            {recent.map((r, i) => (
              <div key={i} className={`flex items-center justify-between px-4 py-3 text-sm ${i > 0 ? "border-t border-border/50" : ""}`}>
                <span className="text-muted">{fmtDate(r.date)}</span>
                <span className="tabular-nums text-text">
                  {fmtTime(r.checkInAt)} → {r.checkOutAt ? fmtTime(r.checkOutAt) : <span className="text-good">in progress</span>}
                </span>
                <span className="w-16 text-right tabular-nums text-muted">{duration(r.checkInAt, r.checkOutAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
