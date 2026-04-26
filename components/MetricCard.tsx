interface Props {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "good" | "bad";
}

export function MetricCard({ label, value, sub, tone = "default" }: Props) {
  const valueClass =
    tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : "text-text";
  return (
    <div className="rounded-xl border border-border bg-panel p-4">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-2 text-2xl font-semibold ${valueClass}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}
