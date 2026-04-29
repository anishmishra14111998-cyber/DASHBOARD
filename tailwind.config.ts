import type { Config } from "tailwindcss";

const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Surfaces — driven by CSS vars, see globals.css
        bg:        v("bg"),
        panel:     v("panel"),
        panel2:    v("panel2"),
        panel3:    v("panel3"),

        // Borders
        border:        v("border"),
        borderStrong:  v("border-strong"),

        // Text scale
        text:    v("text"),
        muted:   v("muted"),
        faint:   v("faint"),

        // Brand accent
        accent:     v("accent"),
        accent2:    v("accent2"),
        accentSoft: v("accent-soft"),

        // Semantic
        good:    v("good"),
        goodSoft: v("good-soft"),
        bad:     v("bad"),
        badSoft: v("bad-soft"),
        warn:    v("warn"),
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "-apple-system",
          "BlinkMacSystemFont",
          "Inter",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      fontSize: {
        "display-xl": ["3.25rem", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        "display-lg": ["2.25rem", { lineHeight: "1.1",  letterSpacing: "-0.02em" }],
        "display":    ["1.75rem", { lineHeight: "1.15", letterSpacing: "-0.015em" }],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(0,0,0,0.4), 0 8px 24px -12px rgba(0,0,0,0.5)",
        ring: "0 0 0 1px rgba(255,255,255,0.04), 0 1px 2px rgba(0,0,0,0.4)",
        glow: "0 0 30px -10px rgba(107,142,255,0.6)",
      },
      backgroundImage: {
        "grid-fade":
          "radial-gradient(circle at 50% 0%, rgba(107,142,255,0.08) 0%, transparent 60%)",
      },
    },
  },
  plugins: [],
};

export default config;
