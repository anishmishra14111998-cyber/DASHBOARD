"use client";
import type { Property } from "@/lib/types";

interface Props {
  properties: Property[];
  value: string;
  onChange: (v: string) => void;
}

export function PropertyFilter({ properties, value, onChange }: Props) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-border bg-panel px-3 py-2 text-sm text-text"
    >
      <option value="all">All properties</option>
      {properties.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name} — {p.city}
        </option>
      ))}
    </select>
  );
}
