"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const TABS = [
  { href: "/",             label: "Revenue Dashboard" },
  { href: "/cleaning",     label: "Cleaning Dashboard" },
  { href: "/reviews",      label: "Reviews" },
  { href: "/gross-margin", label: "Gross Margin" },
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

  return (
    <nav
      className="border-b border-border bg-panel/60 select-none"
      onMouseDown={startDrag}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
    >
      <div className="mx-auto flex max-w-7xl gap-1 px-6">
        {TABS.map((t) => {
          const active    = pathname === t.href || (t.href !== "/" && pathname.startsWith(t.href));
          const highlight = isDragging && dragOver === t.href && !active;

          return (
            <Link
              key={t.href}
              href={t.href}
              draggable={false}
              onDragStart={e => e.preventDefault()}
              onMouseEnter={() => handleEnter(t.href, active)}
              onMouseLeave={() => { if (isDragging) setDragOver(null); }}
              className={[
                "relative px-4 py-3 text-sm font-medium transition-all duration-150",
                active    ? "text-text" : "text-muted hover:text-text",
                highlight ? "scale-110 text-accent bg-accent/10 rounded-lg" : "",
              ].join(" ")}
            >
              {/* drag-hover glow */}
              {highlight && (
                <span className="absolute inset-0 rounded-lg ring-1 ring-accent/40 bg-accent/5 animate-pulse" />
              )}

              <span className="relative">{t.label}</span>

              {/* active underline */}
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
