import type { SourceStatus } from "@/lib/types";

interface Props {
  guesty: SourceStatus;
}

export function SourceStatusBar({ guesty }: Props) {
  const dot = guesty.mode === "live" ? "bg-good" : "bg-bad";
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-panel2 px-3 py-2 text-xs">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      <span className="font-medium text-text">Guesty</span>
      <span className="text-muted">{guesty.mode}</span>
      <span className="text-muted">— {guesty.message}</span>
    </div>
  );
}
