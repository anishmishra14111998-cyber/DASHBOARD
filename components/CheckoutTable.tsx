"use client";
import { useMemo, useState } from "react";
import type { Checkout } from "@/lib/checkouts";
import { GUEST_MGMT_STAFF } from "@/lib/staff";

type SortKey =
  | "propertyName"
  | "confirmationCode"
  | "checkOut"
  | "contacted"
  | "contactedBy"
  | "reviewReceived";

const COLS: { key: SortKey; label: string }[] = [
  { key: "propertyName",     label: "Property" },
  { key: "confirmationCode", label: "Confirmation" },
  { key: "checkOut",         label: "Checkout" },
  { key: "contacted",        label: "Contacted" },
  { key: "contactedBy",      label: "Contacted By" },
  { key: "reviewReceived",   label: "Review" },
];

const CH: Record<string, string> = {
  airbnb: "Airbnb", booking: "Booking", vrbo: "Vrbo",
  "guesty-direct": "Direct", other: "Other",
};

function fmtDate(iso: string): string {
  if (!iso) return "—";
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  });
}

interface Props {
  data: Checkout[];
  onChange: (updated: Checkout) => void;
}

export function CheckoutTable({ data, onChange }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("checkOut");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "contacted" | "no-review">("all");
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [draftUpdate, setDraftUpdate] = useState<Record<string, string>>({});

  const sorted = useMemo(() => {
    let rows = data;

    if (filter === "pending")   rows = rows.filter(r => !r.contacted);
    if (filter === "contacted") rows = rows.filter(r =>  r.contacted);
    if (filter === "no-review") rows = rows.filter(r => !r.reviewReceived);

    if (query.trim()) {
      const q = query.toLowerCase();
      rows = rows.filter((r) =>
        r.propertyName.toLowerCase().includes(q) ||
        r.confirmationCode.toLowerCase().includes(q) ||
        (r.contactedBy?.toLowerCase().includes(q) ?? false) ||
        r.update.toLowerCase().includes(q)
      );
    }

    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "boolean" && typeof bv === "boolean") {
        return ((av ? 1 : 0) - (bv ? 1 : 0)) * dir;
      }
      return String(av ?? "").localeCompare(String(bv ?? "")) * dir;
    });
  }, [data, sortKey, sortDir, query, filter]);

  function clickHeader(k: SortKey) {
    if (k === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  }

  async function patch(row: Checkout, body: Record<string, unknown>) {
    setSaving(p => ({ ...p, [row.id]: true }));
    try {
      const res = await fetch("/api/checkout-crm", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: row.id, ...body }),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      const entry = await res.json();
      onChange({
        ...row,
        contacted:   entry.contacted,
        contactedBy: entry.contactedBy,
        contactedAt: entry.contactedAt,
        update:      entry.update,
      });
    } finally {
      setSaving(p => ({ ...p, [row.id]: false }));
    }
  }

  return (
    <section className="rounded-xl border border-border bg-panel shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
            Checkout Follow-up
          </p>
          <h2 className="mt-1 text-base font-semibold tracking-tight text-text">
            {sorted.length} of {data.length} checkouts
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-border bg-panel2/60 p-1">
            {([
              { v: "all",        label: "All"        },
              { v: "pending",    label: "Pending"    },
              { v: "contacted",  label: "Contacted"  },
              { v: "no-review",  label: "No review"  },
            ] as const).map(o => {
              const active = filter === o.v;
              return (
                <button
                  key={o.v}
                  onClick={() => setFilter(o.v)}
                  className={
                    "rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-all duration-150 " +
                    (active ? "bg-accent text-white shadow-soft" : "text-muted hover:text-text")
                  }
                >
                  {o.label}
                </button>
              );
            })}
          </div>

          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search property, code, staff, update…"
              className="w-64 rounded-lg border border-border bg-panel2 py-2 pl-9 pr-3 text-xs text-text placeholder:text-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </div>
        </div>
      </div>

      <div className="overflow-auto border-t border-border/60">
        <table className="w-full min-w-[1000px] text-sm">
          <thead className="sticky top-0 z-10 bg-panel/95 backdrop-blur">
            <tr className="text-[11px] uppercase tracking-wider text-faint">
              {COLS.map((c) => {
                const active = c.key === sortKey;
                const arrow = active ? (sortDir === "asc" ? "▲" : "▼") : "";
                return (
                  <th
                    key={c.key}
                    onClick={() => clickHeader(c.key)}
                    className={
                      "cursor-pointer select-none border-b border-border px-4 py-3 text-left font-medium transition-colors hover:text-text " +
                      (active ? " text-text" : "")
                    }
                  >
                    {c.label}{arrow && <span className="ml-1 text-accent">{arrow}</span>}
                  </th>
                );
              })}
              <th className="border-b border-border px-4 py-3 text-left font-medium">Update</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={COLS.length + 1} className="px-4 py-12 text-center text-sm text-faint">
                  No checkouts match the current filters.
                </td>
              </tr>
            ) : sorted.map((r) => {
              const isSaving = !!saving[r.id];
              const draft = draftUpdate[r.id] ?? r.update;
              const dirty = draft !== r.update;
              return (
                <tr key={r.id} className="border-t border-border/40 align-top transition-colors hover:bg-panel2/30">
                  <td className="max-w-[200px] truncate px-4 py-3 text-text">
                    <div className="truncate">{r.propertyName}</div>
                    <div className="mt-0.5 text-[10px] uppercase tracking-wider text-faint">
                      {CH[r.channel] ?? r.channel}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-muted">{r.confirmationCode}</td>
                  <td className="px-4 py-3 text-muted tabular-nums whitespace-nowrap">{fmtDate(r.checkOut)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => patch(r, { contacted: !r.contacted })}
                      disabled={isSaving}
                      className={
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-50 " +
                        (r.contacted
                          ? "bg-good/10 text-good hover:bg-good/20"
                          : "bg-warn/10 text-warn hover:bg-warn/20")
                      }
                    >
                      {r.contacted ? "✓ Yes" : "✗ No"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={r.contactedBy ?? ""}
                      disabled={isSaving}
                      onChange={(e) => {
                        const v = e.target.value;
                        patch(r, {
                          contactedBy: v === "" ? null : v,
                          // Auto-flip contacted=true the first time a staff member is picked
                          ...(v && !r.contacted ? { contacted: true } : {}),
                        });
                      }}
                      className="rounded-md border border-border bg-panel2 px-2 py-1 text-xs text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40 disabled:opacity-50"
                    >
                      <option value="">—</option>
                      {GUEST_MGMT_STAFF.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      r.reviewReceived ? "bg-good/10 text-good" : "bg-panel2 text-muted"
                    }`}>
                      {r.reviewReceived
                        ? (r.reviewRating !== null ? `${r.reviewRating.toFixed(1)} ★` : "✓")
                        : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      <textarea
                        value={draft}
                        rows={2}
                        onChange={(e) => setDraftUpdate(p => ({ ...p, [r.id]: e.target.value }))}
                        placeholder="Update from contact…"
                        className="min-w-[220px] flex-1 resize-y rounded-md border border-border bg-panel2 px-2 py-1.5 text-xs text-text placeholder:text-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40"
                      />
                      <button
                        onClick={() => patch(r, { update: draft })}
                        disabled={!dirty || isSaving}
                        className="self-start rounded-md border border-border bg-panel px-2.5 py-1.5 text-[11px] text-text transition-colors hover:border-accent hover:text-accent disabled:opacity-30"
                      >
                        Save
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
