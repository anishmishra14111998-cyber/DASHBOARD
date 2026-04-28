"use client";
import {
  type DateRange,
  type PresetId,
  rangeForPreset,
} from "@/lib/datetime";

interface Props {
  value: DateRange;
  onChange: (r: DateRange) => void;
  presets?: PresetId[];
}

const DEFAULT_PRESETS: PresetId[] = [
  "today",
  "yesterday",
  "this-week",
  "last-month",
  "this-month",
];

const PRESET_LABELS: Record<PresetId, string> = {
  "today":       "Today",
  "yesterday":   "Yesterday",
  "this-week":   "This week",
  "last-7":      "Last 7 days",
  "this-month":  "Month to date",
  "last-month":  "Last month",
  "last-30":     "Last 30 days",
  "last-90":     "Last 90 days",
  "all-time":    "All time",
};

export function TimelineFilter({ value, onChange, presets = DEFAULT_PRESETS }: Props) {
  const presetList = presets.map((id) => ({ id, label: PRESET_LABELS[id] }));

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
    <div className="rounded-xl border border-border bg-panel p-3 shadow-soft">
      <div className="flex flex-wrap items-center gap-2">
        <span className="px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">
          Period
        </span>

        {/* Preset segmented control */}
        <div className="inline-flex rounded-lg border border-border bg-panel2/60 p-1">
          {presetList.map((p) => {
            const active = value.preset === p.id;
            return (
              <button
                key={p.id}
                onClick={() => onChange(rangeForPreset(p.id))}
                className={
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 " +
                  (active
                    ? "bg-accent text-white shadow-soft"
                    : "text-muted hover:text-text")
                }
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <span className="mx-1 h-5 w-px bg-border" />

        {/* Custom range */}
        <div
          className={
            "flex items-center gap-1.5 rounded-lg border px-2 py-1 transition-colors " +
            (isCustom
              ? "border-accent/60 bg-accent/5"
              : "border-border bg-panel2/40")
          }
        >
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">
            Custom
          </span>
          <input
            type="date"
            value={value.start}
            max={value.end}
            onChange={(e) => setStart(e.target.value)}
            className="rounded-md border border-border bg-panel px-2 py-1 text-xs text-text accent-accent focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40"
          />
          <span className="text-faint">→</span>
          <input
            type="date"
            value={value.end}
            min={value.start}
            onChange={(e) => setEnd(e.target.value)}
            className="rounded-md border border-border bg-panel px-2 py-1 text-xs text-text accent-accent focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40"
          />
        </div>

        {/* Resolved range pinned right */}
        <div className="ml-auto flex items-center gap-2 text-[11px] text-muted">
          <span className={isCustom ? "text-accent" : "text-text"}>
            {isCustom ? "Custom range" : value.label}
          </span>
          <span>·</span>
          <span className="font-mono text-text">{value.start}</span>
          <span>→</span>
          <span className="font-mono text-text">{value.end}</span>
        </div>
      </div>
    </div>
  );
}
