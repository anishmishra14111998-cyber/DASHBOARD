"use client";
import { useState, useMemo } from "react";
import type { CoverageBooking } from "@/app/api/review-coverage/route";
import type { CrmEntry, CrmStore, NoReviewStatus, SubStarStatus } from "@/lib/reviewCrm";

const CH: Record<string, string> = {
  airbnb: "Airbnb", booking: "Booking.com", vrbo: "Vrbo",
  "guesty-direct": "Direct", other: "Other",
};

function fmtDate(iso: string) {
  if (!iso) return "—";
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined,
    { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
function fmtDT(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    + " at " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function Stars({ rating }: { rating: number }) {
  const f = Math.round(rating);
  return (
    <span className="tracking-wider text-sm">
      <span className="text-warn">{"★".repeat(f)}</span>
      <span className="text-borderStrong">{"★".repeat(5 - f)}</span>
    </span>
  );
}

interface Props {
  bookings: CoverageBooking[];
  initialCrm: CrmStore;
}

export function ReviewCrm({ bookings, initialCrm }: Props) {
  const [crm, setCrm] = useState<CrmStore>(initialCrm);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [noteInput, setNoteInput] = useState<Record<string, string>>({});

  const noReview  = useMemo(() => bookings.filter(b => !b.hasReview), [bookings]);
  const subStar   = useMemo(() => bookings.filter(b => b.hasReview && b.reviewRating !== null && b.reviewRating < 5), [bookings]);

  function getEntry(id: string): CrmEntry {
    return crm[id] ?? { bookingId: id, noReviewStatus: "pending", notes: [], updatedAt: "" };
  }

  async function patch(bookingId: string, update: Record<string, unknown>, note?: string) {
    setSaving(p => ({ ...p, [bookingId]: true }));
    // Optimistic
    setCrm(p => ({
      ...p,
      [bookingId]: { ...getEntry(bookingId), ...update, updatedAt: new Date().toISOString() } as CrmEntry,
    }));
    if (noteInput[bookingId]) setNoteInput(p => ({ ...p, [bookingId]: "" }));
    try {
      const res = await fetch("/api/review-crm", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, ...update, note: note ?? noteInput[bookingId] ?? undefined }),
      });
      if (res.ok) { const updated = await res.json(); setCrm(p => ({ ...p, [bookingId]: updated })); }
    } finally {
      setSaving(p => ({ ...p, [bookingId]: false }));
    }
  }

  function toggle(id: string) {
    setExpanded(p => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  // ---- Kanban buckets for no-review ----
  const noPending   = noReview.filter(b => (crm[b.id]?.noReviewStatus ?? "pending") === "pending");
  const noContacted = noReview.filter(b => crm[b.id]?.noReviewStatus === "contacted");
  const noReceived  = noReview.filter(b => crm[b.id]?.noReviewStatus === "received");

  // ---- Kanban buckets for sub-star ----
  const ssPending    = subStar.filter(b => !crm[b.id]?.subStarStatus || crm[b.id].subStarStatus === "pending");
  const ssInProgress = subStar.filter(b => crm[b.id]?.subStarStatus === "ask-change" || crm[b.id]?.subStarStatus === "dispute");
  const ssResolved   = subStar.filter(b => crm[b.id]?.subStarStatus === "resolved");

  // ---- KPIs ----
  const totalNo  = noReview.length;
  const covPct   = bookings.length ? Math.round((bookings.filter(b => b.hasReview).length / bookings.length) * 100) : 0;

  return (
    <div className="space-y-12">
      {/* ── Summary ── */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Review CRM</p>
        <h2 className="mt-1 text-base font-semibold tracking-tight text-text">
          {bookings.length.toLocaleString()} completed stays · {covPct}% coverage
        </h2>
        <p className="mt-0.5 text-[11px] text-muted">
          Track outreach for missing reviews and manage sub-5-star recovery
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Awaiting review" value={String(totalNo)} tone="default" />
          <Kpi label="Contacted"       value={String(noContacted.length)} tone="accent" />
          <Kpi label="Received"        value={String(noReceived.length)}  tone="good"   />
          <Kpi label="Sub-5★ to fix"   value={String(subStar.length)}     tone={subStar.length > 0 ? "bad" : "default"} />
        </div>
      </div>

      {/* ── Awaiting Review Kanban ── */}
      <div className="space-y-4">
        <div className="flex items-baseline gap-3">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
            Awaiting Review
          </h3>
          <span className="text-[11px] text-faint">{totalNo} bookings · no guest review yet</span>
        </div>

        {totalNo === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-faint">
            All completed stays have a review — great coverage!
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <KanbanCol
              title="Pending"
              count={noPending.length}
              tone="default"
              bookings={noPending}
              crm={crm}
              expanded={expanded}
              noteInput={noteInput}
              saving={saving}
              onToggle={toggle}
              onNoteChange={(id, v) => setNoteInput(p => ({ ...p, [id]: v }))}
              onSaveNote={(id) => patch(id, {}, noteInput[id])}
              renderAction={(b) => (
                <button
                  onClick={() => patch(b.id, { noReviewStatus: "contacted" as NoReviewStatus })}
                  disabled={saving[b.id]}
                  className="btn-action btn-accent"
                >
                  Mark Contacted ▶
                </button>
              )}
            />
            <KanbanCol
              title="Contacted"
              count={noContacted.length}
              tone="accent"
              bookings={noContacted}
              crm={crm}
              expanded={expanded}
              noteInput={noteInput}
              saving={saving}
              onToggle={toggle}
              onNoteChange={(id, v) => setNoteInput(p => ({ ...p, [id]: v }))}
              onSaveNote={(id) => patch(id, {}, noteInput[id])}
              renderAction={(b) => (
                <button
                  onClick={() => patch(b.id, { noReviewStatus: "received" as NoReviewStatus })}
                  disabled={saving[b.id]}
                  className="btn-action btn-good"
                >
                  ✓ Mark Received
                </button>
              )}
            />
            <KanbanCol
              title="Received"
              count={noReceived.length}
              tone="good"
              bookings={noReceived}
              crm={crm}
              expanded={expanded}
              noteInput={noteInput}
              saving={saving}
              onToggle={toggle}
              onNoteChange={(id, v) => setNoteInput(p => ({ ...p, [id]: v }))}
              onSaveNote={(id) => patch(id, {}, noteInput[id])}
              renderAction={null}
            />
          </div>
        )}
      </div>

      {/* ── Sub-5-star Recovery ── */}
      {subStar.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-baseline gap-3">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
              Sub-5★ Recovery
            </h3>
            <span className="text-[11px] text-faint">{subStar.length} reviews below 5 stars</span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Pending */}
            <div className="space-y-2">
              <ColHeader title="To Action" count={ssPending.length} tone="default" />
              <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
                {ssPending.length === 0 && <EmptyCol />}
                {ssPending.map(b => (
                  <SubStarCard
                    key={b.id}
                    b={b}
                    entry={crm[b.id]}
                    expanded={expanded.has(b.id + "-ss")}
                    noteVal={noteInput[b.id + "-ss"] ?? ""}
                    saving={!!saving[b.id]}
                    onToggle={() => toggle(b.id + "-ss")}
                    onNoteChange={v => setNoteInput(p => ({ ...p, [b.id + "-ss"]: v }))}
                    onSaveNote={() => patch(b.id, {}, noteInput[b.id + "-ss"] ?? "")}
                    renderAction={
                      <div className="flex gap-2">
                        <button
                          onClick={() => patch(b.id, { subStarStatus: "ask-change" as SubStarStatus, subStarRoute: "change-review" })}
                          disabled={saving[b.id]}
                          className="btn-action-sm btn-warn flex-1"
                        >
                          Ask to Change
                        </button>
                        <button
                          onClick={() => patch(b.id, { subStarStatus: "dispute" as SubStarStatus, subStarRoute: "dispute" })}
                          disabled={saving[b.id]}
                          className="btn-action-sm btn-bad flex-1"
                        >
                          Dispute
                        </button>
                      </div>
                    }
                  />
                ))}
              </div>
            </div>

            {/* In Progress */}
            <div className="space-y-2">
              <ColHeader title="In Progress" count={ssInProgress.length} tone="accent" />
              <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
                {ssInProgress.length === 0 && <EmptyCol />}
                {ssInProgress.map(b => (
                  <SubStarCard
                    key={b.id}
                    b={b}
                    entry={crm[b.id]}
                    expanded={expanded.has(b.id + "-ss")}
                    noteVal={noteInput[b.id + "-ss"] ?? ""}
                    saving={!!saving[b.id]}
                    onToggle={() => toggle(b.id + "-ss")}
                    onNoteChange={v => setNoteInput(p => ({ ...p, [b.id + "-ss"]: v }))}
                    onSaveNote={() => patch(b.id, {}, noteInput[b.id + "-ss"] ?? "")}
                    renderAction={
                      <button
                        onClick={() => patch(b.id, { subStarStatus: "resolved" as SubStarStatus })}
                        disabled={saving[b.id]}
                        className="btn-action btn-good w-full"
                      >
                        ✓ Mark Resolved
                      </button>
                    }
                  />
                ))}
              </div>
            </div>

            {/* Resolved */}
            <div className="space-y-2">
              <ColHeader title="Resolved" count={ssResolved.length} tone="good" />
              <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
                {ssResolved.length === 0 && <EmptyCol />}
                {ssResolved.map(b => (
                  <SubStarCard
                    key={b.id}
                    b={b}
                    entry={crm[b.id]}
                    expanded={expanded.has(b.id + "-ss")}
                    noteVal={noteInput[b.id + "-ss"] ?? ""}
                    saving={!!saving[b.id]}
                    onToggle={() => toggle(b.id + "-ss")}
                    onNoteChange={v => setNoteInput(p => ({ ...p, [b.id + "-ss"]: v }))}
                    onSaveNote={() => patch(b.id, {}, noteInput[b.id + "-ss"] ?? "")}
                    renderAction={null}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Kanban column ───────────────────────────────────────────────────────────

interface KanbanColProps {
  title: string;
  count: number;
  tone: "default" | "accent" | "good";
  bookings: CoverageBooking[];
  crm: CrmStore;
  expanded: Set<string>;
  noteInput: Record<string, string>;
  saving: Record<string, boolean>;
  onToggle: (id: string) => void;
  onNoteChange: (id: string, v: string) => void;
  onSaveNote: (id: string) => void;
  renderAction: ((b: CoverageBooking) => React.ReactNode) | null;
}

function KanbanCol({ title, count, tone, bookings, crm, expanded, noteInput, saving, onToggle, onNoteChange, onSaveNote, renderAction }: KanbanColProps) {
  return (
    <div className="space-y-2">
      <ColHeader title={title} count={count} tone={tone} />
      <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
        {count === 0 && <EmptyCol />}
        {bookings.map(b => {
          const entry = crm[b.id];
          const isExpanded = expanded.has(b.id);
          const isSaving = !!saving[b.id];
          return (
            <div key={b.id} className="rounded-xl border border-border bg-panel shadow-soft transition-colors hover:border-borderStrong">
              {/* Card header */}
              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text">{b.propertyName}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-muted">{b.confirmationCode}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-border bg-panel2 px-2 py-0.5 text-[10px] text-muted">
                    {CH[b.channel] ?? b.channel}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-muted">
                  <span>Out: {fmtDate(b.checkOut)}</span>
                  {entry?.contactedAt && (
                    <span className="flex items-center gap-1 text-accent">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      {fmtDT(entry.contactedAt)}
                    </span>
                  )}
                  {entry?.receivedAt && (
                    <span className="flex items-center gap-1 text-good">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      {fmtDT(entry.receivedAt)}
                    </span>
                  )}
                </div>

                {/* Latest note snippet */}
                {entry?.notes?.length > 0 && !isExpanded && (
                  <p className="truncate rounded-md bg-panel2 px-2 py-1 text-[11px] text-muted">
                    💬 {entry.notes[entry.notes.length - 1].text}
                  </p>
                )}

                {/* Expand toggle */}
                <button
                  onClick={() => onToggle(b.id)}
                  className="flex items-center gap-1 text-[10px] text-faint hover:text-muted transition-colors"
                >
                  {isExpanded ? "▲ collapse" : `▼ notes ${entry?.notes?.length ? `(${entry.notes.length})` : ""}`}
                </button>
              </div>

              {/* Expanded notes */}
              {isExpanded && (
                <div className="border-t border-border/60 px-4 pb-3 pt-3 space-y-3">
                  {entry?.notes?.length > 0 && (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {entry.notes.map((n, i) => (
                        <div key={i} className="rounded-lg bg-panel2 px-3 py-2 text-[11px]">
                          <p className="text-text">{n.text}</p>
                          <p className="mt-0.5 text-faint">{fmtDT(n.createdAt)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <textarea
                      value={noteInput[b.id] ?? ""}
                      onChange={e => onNoteChange(b.id, e.target.value)}
                      placeholder="Add a note…"
                      rows={2}
                      className="flex-1 resize-none rounded-lg border border-border bg-panel2 px-3 py-2 text-xs text-text placeholder:text-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40"
                    />
                    <button
                      onClick={() => onSaveNote(b.id)}
                      disabled={!noteInput[b.id]?.trim() || isSaving}
                      className="self-end rounded-lg border border-border bg-panel px-3 py-2 text-xs text-text transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}

              {/* Action */}
              {renderAction && (
                <div className="border-t border-border/60 px-4 py-3">
                  {renderAction(b)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Sub-star card ───────────────────────────────────────────────────────────

interface SubStarCardProps {
  b: CoverageBooking;
  entry?: CrmEntry;
  expanded: boolean;
  noteVal: string;
  saving: boolean;
  onToggle: () => void;
  onNoteChange: (v: string) => void;
  onSaveNote: () => void;
  renderAction: React.ReactNode;
}

function SubStarCard({ b, entry, expanded, noteVal, saving: _saving, onToggle, onNoteChange, onSaveNote, renderAction }: SubStarCardProps) {
  const routeLabel = entry?.subStarRoute === "change-review" ? "Asking to change"
    : entry?.subStarRoute === "dispute" ? "Dispute route" : "";

  return (
    <div className="rounded-xl border border-border bg-panel shadow-soft transition-colors hover:border-borderStrong">
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-text">{b.propertyName}</p>
            <p className="mt-0.5 font-mono text-[11px] text-muted">{b.confirmationCode}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Stars rating={b.reviewRating!} />
            <span className="rounded-full border border-border bg-panel2 px-2 py-0.5 text-[10px] text-muted">
              {CH[b.channel] ?? b.channel}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-muted">
          <span>Out: {fmtDate(b.checkOut)}</span>
          {routeLabel && entry?.subStarActedAt && (
            <span className="text-warn">{routeLabel} · {fmtDT(entry.subStarActedAt)}</span>
          )}
        </div>

        {b.reviewText && (
          <p className={`rounded-lg bg-panel2 px-3 py-2 text-[11px] text-muted leading-relaxed ${!expanded ? "line-clamp-2" : ""}`}>
            "{b.reviewText}"
          </p>
        )}

        {(entry?.notes?.length ?? 0) > 0 && !expanded && (
          <p className="truncate rounded-md bg-panel2 px-2 py-1 text-[11px] text-muted">
            💬 {entry!.notes[entry!.notes.length - 1].text}
          </p>
        )}

        <button
          onClick={onToggle}
          className="flex items-center gap-1 text-[10px] text-faint hover:text-muted transition-colors"
        >
          {expanded ? "▲ collapse" : `▼ notes ${entry?.notes?.length ? `(${entry.notes.length})` : ""}`}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-border/60 px-4 pb-3 pt-3 space-y-3">
          {(entry?.notes?.length ?? 0) > 0 && (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {(entry!.notes).map((n, i) => (
                <div key={i} className="rounded-lg bg-panel2 px-3 py-2 text-[11px]">
                  <p className="text-text">{n.text}</p>
                  <p className="mt-0.5 text-faint">{fmtDT(n.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <textarea
              value={noteVal}
              onChange={e => onNoteChange(e.target.value)}
              placeholder="Add a note…"
              rows={2}
              className="flex-1 resize-none rounded-lg border border-border bg-panel2 px-3 py-2 text-xs text-text placeholder:text-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40"
            />
            <button
              onClick={onSaveNote}
              disabled={!noteVal.trim()}
              className="self-end rounded-lg border border-border bg-panel px-3 py-2 text-xs text-text transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {renderAction && (
        <div className="border-t border-border/60 px-4 py-3">
          {renderAction}
        </div>
      )}
    </div>
  );
}

// ─── Shared micro-components ─────────────────────────────────────────────────

function ColHeader({ title, count, tone }: { title: string; count: number; tone: "default" | "accent" | "good" | "bad" | "warn" }) {
  const dotCls = tone === "accent" ? "bg-accent" : tone === "good" ? "bg-good" : tone === "bad" ? "bg-bad" : tone === "warn" ? "bg-warn" : "bg-borderStrong";
  return (
    <div className="flex items-center gap-2 px-1">
      <span className={"h-2 w-2 rounded-full " + dotCls} />
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{title}</span>
      <span className="ml-auto rounded-full bg-panel2 px-2 py-0.5 text-[11px] text-faint">{count}</span>
    </div>
  );
}

function EmptyCol() {
  return (
    <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-[11px] text-faint">
      No bookings here
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: "default" | "accent" | "good" | "bad" }) {
  const valCls = tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : tone === "accent" ? "text-accent" : "text-text";
  const bar    = tone === "good" ? "bg-good" : tone === "bad" ? "bg-bad" : tone === "accent" ? "bg-accent" : "bg-borderStrong";
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-panel p-4 shadow-soft">
      <div className={"absolute inset-x-0 top-0 h-px opacity-50 " + bar} />
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</div>
      <div className={"mt-2 text-2xl tabular-nums font-semibold " + valCls}>{value}</div>
    </div>
  );
}
