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
  const pathname = usePathname();
  const router   = useRouter();
  const [isDragging, setIsDragging] = useState(false);

  return (
    <nav
      className="border-b border-border bg-panel/60 select-none"
      onMouseDown={() => setIsDragging(true)}
      onMouseUp={() => setIsDragging(false)}
      onMouseLeave={() => setIsDragging(false)}
    >
      <div className="mx-auto flex max-w-7xl gap-1 px-6">
        {TABS.map((t) => {
          const active = pathname === t.href || (t.href !== "/" && pathname.startsWith(t.href));
          return (
            <Link
              key={t.href}
              href={t.href}
              onMouseEnter={() => {
                if (isDragging && !active) router.push(t.href);
              }}
              className={
                "relative px-4 py-3 text-sm font-medium transition-colors " +
                (active ? "text-text" : "text-muted hover:text-text")
              }
            >
              {t.label}
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
