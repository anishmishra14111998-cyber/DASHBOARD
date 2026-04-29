import { ThemeToggle } from "./ThemeToggle";

// Branded top banner for COVETED HOSPITALITY.
// Logo image lives at `public/logo.png` and is served by Next.js as `/logo.png`.
export function BrandHeader() {
  return (
    <div className="relative overflow-hidden border-b border-accent/40 bg-gradient-to-b from-[#0d1830] via-[#101a32] to-[#0b0f1d] shadow-[inset_0_-1px_0_rgba(91,140,255,0.25)]">
      {/* subtle radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(91,140,255,0.18) 0%, rgba(91,140,255,0) 60%)",
        }}
      />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />

      <div className="relative mx-auto flex max-w-7xl items-center gap-3 sm:gap-5 px-4 sm:px-6 py-4 sm:py-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="Coveted Hospitality"
          className="h-12 w-12 rounded-lg shadow-md shadow-black/40 ring-1 ring-white/10 sm:h-16 sm:w-16 md:h-20 md:w-20"
        />
        <div className="flex flex-col min-w-0 flex-1">
          <h1
            className="text-base font-bold uppercase tracking-[0.18em] text-white sm:text-2xl md:text-3xl truncate"
            style={{ textShadow: "0 0 20px rgba(91,140,255,0.35)" }}
          >
            Coveted Hospitality
          </h1>
          <p className="mt-1 text-[10px] italic tracking-wide text-white/60 sm:text-xs md:text-sm truncate">
            Short-Term Rental Operations &nbsp;·&nbsp; Charlotte &amp; Raleigh-Durham
          </p>
        </div>
        <div className="flex-shrink-0">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
