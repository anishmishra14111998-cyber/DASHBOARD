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

      <div className="relative mx-auto flex max-w-7xl items-center gap-5 px-6 py-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="Coveted Hospitality"
          className="h-16 w-16 rounded-lg shadow-md shadow-black/40 ring-1 ring-white/10 md:h-20 md:w-20"
        />
        <div className="flex flex-col">
          <h1
            className="text-2xl font-bold uppercase tracking-[0.18em] text-white md:text-3xl"
            style={{ textShadow: "0 0 20px rgba(91,140,255,0.35)" }}
          >
            Coveted Hospitality
          </h1>
          <p className="mt-1 text-xs italic tracking-wide text-muted md:text-sm">
            Short-Term Rental Operations &nbsp;·&nbsp; Charlotte &amp; Raleigh-Durham
          </p>
        </div>
      </div>
    </div>
  );
}
