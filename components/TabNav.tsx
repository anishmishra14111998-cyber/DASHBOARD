"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const TABS = [
  { href: "/",             full: "Revenue Dashboard",    short: "Revenue" },
  { href: "/cleaning",     full: "Cleaning Dashboard",   short: "Cleaning" },
  { href: "/reviews",      full: "Reviews",              short: "Reviews" },
  { href: "/gross-margin", full: "Gross Margin",         short: "Margin" },
  { href: "/cc-portfolio", full: "CC Portfolio Monthly", short: "CC Portfolio" },
];

export function TabNav() {
  const pathname    = usePathname();
  const router      = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [dragOver,   setDragOver]   = useState<string | null>(null);

  function startDrag() { setIsDragging(true); }
  function endDrag()   { setIsDragging(false); setDragOver(null); }

  function handleEnter(href: string, active: boolean) {
    if (!isDragging) return;
    setDragOver(href);
    if (!active) router.push(href);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!isDragging) return;
    const t = e.touches[0];
    if (!t) return;
    const el = document.elementFromPoint(t.clientX, t.clientY);
    const tabEl = el?.closest("[data-tab-href]") as HTMLElement | null;
    if (tabEl) {
      const href = tabEl.dataset.tabHref!;
      setDragOver(href);
      if (href !== pathname) router.push(href);
    }
  }

  return (
    <nav
      className="border-b border-border bg-panel/60 select-none"
      onMouseDown={startDrag}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      onTouchStart={startDrag}
      onTouchMove={handleTouchMove}
      onTouchEnd={endDrag}
      onTouchCancel={endDrag}
    >
      <div className="mx-auto flex max-w-7xl gap-0.5 sm:gap-1 px-3 sm:px-6 overflow-x-auto scrollbar-hide">
        {TABS.map((t) => {
          const active    = pathname === t.href || (t.href !== "/" && pathname.startsWith(t.href));
          const highlight = isDragging && dragOver === t.href && !active;

          return (
            <Link
              key={t.href}
              href={t.href}
              data-tab-href={t.href}
              draggable={false}
              onDragStart={e => e.preventDefault()}
              onMouseEnter={() => handleEnter(t.href, active)}
              onMouseLeave={() => { if (isDragging) setDragOver(null); }}
              className={[
                "relative flex-shrink-0 whitespace-nowrap px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium transition-all duration-150",
                active    ? "text-text" : "text-muted hover:text-text",
                highlight ? "scale-110 text-accent bg-accent/10 rounded-lg" : "",
              ].join(" ")}
            >
              {highlight && (
                <span className="absolute inset-0 rounded-lg ring-1 ring-accent/40 bg-accent/5 animate-pulse" />
              )}
              <span className="relative sm:hidden">{t.short}</span>
              <span className="relative hidden sm:inline">{t.full}</span>
              {active && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-accent to-[#7a9eff]" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
