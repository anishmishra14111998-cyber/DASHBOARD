import type { SourceStatus } from "@/lib/types";

interface Props {
  guesty: SourceStatus;
}

export function SourceStatusBar({ guesty }: Props) {
  const live = guesty.mode === "live";
  return (
    <div
      className={
        "flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] " +
        (live
          ? "border-good/30 bg-good/5 text-good"
          : "border-bad/30 bg-bad/5 text-bad")
      }
    >
      <span className={"relative inline-flex h-2 w-2 rounded-full " + (live ? "bg-good" : "bg-bad")}>
        {live && (
          <span className="absolute inset-0 animate-ping rounded-full bg-good/60" />
        )}
      </span>
      <span className="font-medium uppercase tracking-wider">
        {live ? "Live" : "Mock"}
      </span>
      <span className="text-muted normal-case">·</span>
      <span className="text-muted normal-case">{guesty.message}</span>
    </div>
  );
}
