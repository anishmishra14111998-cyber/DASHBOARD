"use client";
import {
  type DateRange,
  type PresetId,
  rangeForPreset,
} from "@/lib/datetime";

interface Props {
  value: DateRange;
  onChange: (r: DateRange) => void;
}

const PRESETS: { id: PresetId; label: string }[] = [
  { id: "today",       label: "Today" },
  { id: "yesterday",   label: "Yesterday" },
  { id: "this-week",   label: "This week" },
  { id: "last-month",  label: "Last month" },
  { id: "this-month",  label: "Month to date" },
];

const CalendarIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="text-accent"
  >
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8"  y1="2" x2="8"  y2="6" />
    <line x1="3"  y1="10" x2="21" y2="10" />
  </svg>
);

export function TimelineFilter({ value, onChange }: Props) {
  const isCustom = !value.preset;

  function setStart(start: string) {
    if (!start) return;
    onChange({
      start,
      end: value.end < start ? start : value.end,
      label: "Custom range",
      preset: undefined,
    });
  }
  function setEnd(end: string) {
    if (!end) return;
    onChange({
      start: value.start > end ? end : value.start,
      end,
      label: "Custom range",
      preset: undefined,
    });
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-panel via-panel to-panel2/60 shadow-xl shadow-black/30">
      <div className="flex flex-wrap items-center gap-3 border-b border-border/60 px-5 py-3">
        <div className="flex items-center gap-2">
          <CalendarIcon />
          <span className="text-xs font-semibold uppercase tracking-wider text-text">
            Date range
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs">
          <span className={isCustom ? "text-accent" : "text-muted"}>
            {isCustom ? "Custom range" : value.label}
          </span>
          <span className="rounded-md bg-panel2 px-2 py-0.5 font-mono text-accent">
            {value.start}
          </span>
          <span className="text-muted">→</span>
          <span className="rounded-md bg-panel2 px-2 py-0.5 font-mono text-accent">
            {value.end}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-5 py-4">
        {PRESETS.map((p) => {
          const active = value.preset === p.id;
          return (
            <button
              key={p.id}
              onClick={() => onChange(rangeForPreset(p.id))}
              className={
                "rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-150 " +
                (active
                  ? "bg-gradient-to-r from-accent to-[#7a9eff] text-white shadow-lg shadow-accent/40 ring-1 ring-accent/50"
                  : "border border-border bg-panel2/60 text-muted hover:-translate-y-0.5 hover:border-accent/60 hover:bg-panel hover:text-text")
              }
            >
              {p.label}
            </button>
          );
        })}

        <div className="mx-2 h-6 w-px bg-border" />

        <div
          className={
            "flex items-center gap-1.5 rounded-full px-3 py-1 transition-colors " +
            (isCustom ? "bg-accent/10 ring-1 ring-accent/40" : "bg-transparent")
          }
        >
          <span className="text-xs uppercase tracking-wider text-muted">Custom</span>
          <input
            type="date"
            value={value.start}
            max={value.end}
            onChange={(e) => setStart(e.target.value)}
            className="rounded-md border border-border bg-panel2 px-2 py-1 text-xs text-text accent-accent focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40"
          />
          <span className="text-muted">→</span>
          <input
            type="date"
            value={value.end}
            min={value.start}
            onChange={(e) => setEnd(e.target.value)}
            className="rounded-md border border-border bg-panel2 px-2 py-1 text-xs text-text accent-accent focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40"
          />
        </div>
      </div>
    </div>
  );
}
