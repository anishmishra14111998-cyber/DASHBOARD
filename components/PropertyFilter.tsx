"use client";
import type { Property } from "@/lib/types";

interface Props {
  properties: Property[];
  value: string;
  onChange: (v: string) => void;
}

export function PropertyFilter({ properties, value, onChange }: Props) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-lg border border-border bg-panel py-2 pl-3 pr-8 text-sm text-text shadow-ring transition-colors hover:border-borderStrong focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40"
      >
        <option value="all">All properties</option>
        {properties.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} — {p.city}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted"
        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  );
}
