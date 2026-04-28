import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Surfaces — slightly cooler, more depth
        bg:        "#08090d",
        panel:     "#0f1117",
        panel2:    "#171a23",
        panel3:    "#1f2331",

        // Borders — subtle by default, strong for emphasis
        border:        "#222633",
        borderStrong:  "#363c50",

        // Text scale
        text:    "#eef0f6",
        muted:   "#8d96aa",
        faint:   "#5b6378",

        // Brand accent
        accent:     "#6b8eff",
        accent2:    "#8fa6ff",
        accentSoft: "#13193a",

        // Semantic
        good:    "#22c55e",
        goodSoft: "#0f2a1c",
        bad:     "#f43f5e",
        badSoft: "#3a1623",
        warn:    "#f59e0b",
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
        // tighter, more confident scale
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
