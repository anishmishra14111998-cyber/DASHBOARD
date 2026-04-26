"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS: { href: string; label: string }[] = [
  { href: "/",         label: "Revenue Dashboard" },
  { href: "/cleaning", label: "Cleaning Dashboard" },
];

export function TabNav() {
  const pathname = usePathname();
  return (
    <nav className="border-b border-border bg-panel/60">
      <div className="mx-auto flex max-w-7xl gap-1 px-6">
        {TABS.map((t) => {
          const active = pathname === t.href || (t.href !== "/" && pathname.startsWith(t.href));
          return (
            <Link
              key={t.href}
              href={t.href}
              className={
                "relative px-4 py-3 text-sm font-medium transition-colors " +
                (active
                  ? "text-text"
                  : "text-muted hover:text-text")
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
