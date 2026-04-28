"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const DEFAULT_TABS = [
  { href: "/",             label: "Revenue Dashboard" },
  { href: "/cleaning",     label: "Cleaning Dashboard" },
  { href: "/reviews",      label: "Reviews" },
  { href: "/gross-margin", label: "Gross Margin" },
];

const STORAGE_KEY = "coveted-tab-order";

function loadSavedOrder(): typeof DEFAULT_TABS {
  try {
    const saved: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!Array.isArray(saved)) return DEFAULT_TABS;
    const reordered = saved
      .map(href => DEFAULT_TABS.find(t => t.href === href))
      .filter(Boolean) as typeof DEFAULT_TABS;
    DEFAULT_TABS.forEach(t => {
      if (!reordered.find(r => r.href === t.href)) reordered.push(t);
    });
    return reordered;
  } catch {
    return DEFAULT_TABS;
  }
}

export function TabNav() {
  const pathname = usePathname();
  const [tabs, setTabs] = useState(DEFAULT_TABS);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const dragNode = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setTabs(loadSavedOrder());
  }, []);

  function onDragStart(e: React.DragEvent<HTMLDivElement>, i: number) {
    dragNode.current = e.currentTarget;
    setDragIdx(i);
    e.dataTransfer.effectAllowed = "move";
  }

  function onDragOver(e: React.DragEvent<HTMLDivElement>, i: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (i !== overIdx) setOverIdx(i);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>, i: number) {
    e.preventDefault();
    if (dragIdx === null || dragIdx === i) { reset(); return; }
    const next = [...tabs];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(i, 0, moved);
    setTabs(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next.map(t => t.href))); } catch {}
    reset();
  }

  function reset() {
    setDragIdx(null);
    setOverIdx(null);
    dragNode.current = null;
  }

  return (
    <nav className="border-b border-border bg-panel/60">
      <div className="mx-auto flex max-w-7xl gap-1 px-6">
        {tabs.map((t, i) => {
          const active = pathname === t.href || (t.href !== "/" && pathname.startsWith(t.href));
          const isDragging = dragIdx === i;
          const dropBefore = overIdx === i && dragIdx !== null && dragIdx > i;
          const dropAfter  = overIdx === i && dragIdx !== null && dragIdx < i;
          return (
            <div
              key={t.href}
              draggable
              onDragStart={e => onDragStart(e, i)}
              onDragOver={e => onDragOver(e, i)}
              onDrop={e => onDrop(e, i)}
              onDragEnd={reset}
              className={[
                "relative flex items-stretch transition-all duration-150 cursor-grab active:cursor-grabbing select-none",
                isDragging ? "opacity-30 scale-95" : "",
                dropBefore ? "border-l-2 border-accent" : "border-l-2 border-transparent",
                dropAfter  ? "border-r-2 border-accent" : overIdx === i && !dropBefore ? "border-r-2 border-transparent" : "",
              ].join(" ")}
            >
              <Link
                href={t.href}
                draggable={false}
                className={
                  "relative block px-4 py-3 text-sm font-medium transition-colors " +
                  (active ? "text-text" : "text-muted hover:text-text")
                }
              >
                {t.label}
                {active && (
                  <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-accent to-[#7a9eff]" />
                )}
              </Link>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
