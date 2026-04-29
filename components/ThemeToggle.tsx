"use client";
import { useEffect, useState } from "react";

type Theme = "dark" | "light";
const STORAGE_KEY = "coveted-theme";

function getInitialTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  const cur = document.documentElement.getAttribute("data-theme");
  return cur === "light" ? "light" : "dark";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => { setTheme(getInitialTheme()); }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      className="group relative inline-flex h-9 w-16 items-center rounded-full border border-border bg-panel/80 backdrop-blur transition-colors hover:border-borderStrong"
    >
      {/* Track icons */}
      <span className="absolute left-2 text-[10px] text-warn opacity-80">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      </span>
      <span className="absolute right-2 text-[10px] text-accent opacity-80">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      </span>
      {/* Knob */}
      <span
        className={`relative ml-1 h-7 w-7 rounded-full bg-gradient-to-br shadow-md transition-all duration-200 ease-out ${
          isDark
            ? "translate-x-7 from-[#1f2740] to-[#0d1426] ring-1 ring-accent/40"
            : "translate-x-0 from-[#fef3c7] to-[#fbbf24] ring-1 ring-warn/40"
        }`}
      />
    </button>
  );
}
