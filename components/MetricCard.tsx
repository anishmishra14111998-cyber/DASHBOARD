interface Props {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "good" | "bad" | "accent";
  size?: "default" | "lg";
}

export function MetricCard({ label, value, sub, tone = "default", size = "default" }: Props) {
  const valueClass =
    tone === "good"
      ? "text-good"
      : tone === "bad"
      ? "text-bad"
      : tone === "accent"
      ? "text-accent"
      : "text-text";
  const accentBar =
    tone === "good"
      ? "bg-good"
      : tone === "bad"
      ? "bg-bad"
      : tone === "accent"
      ? "bg-accent"
      : "bg-borderStrong";

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-panel p-5 shadow-soft transition-colors hover:border-borderStrong">
      <div className={"absolute inset-x-0 top-0 h-px " + accentBar + " opacity-50"} />
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
        {label}
      </div>
      <div
        className={
          "mt-2 font-semibold tabular-nums " +
          (size === "lg" ? "text-display-lg" : "text-display") +
          " " +
          valueClass
        }
      >
        {value}
      </div>
      {sub && <div className="mt-1.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}
