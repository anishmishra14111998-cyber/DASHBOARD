import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b0d12",
        panel: "#12151c",
        panel2: "#181c25",
        border: "#262b36",
        muted: "#8a93a6",
        text: "#e6e9f0",
        accent: "#5b8cff",
        good: "#33c48d",
        bad: "#ff6b6b",
      },
    },
  },
  plugins: [],
};

export default config;
