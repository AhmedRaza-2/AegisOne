import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef8ff",
          100: "#d8eeff",
          200: "#b9e0ff",
          300: "#89cfff",
          400: "#52b4ff",
          500: "#2a91ff",
          600: "#1a75f5",
          700: "#0f5ae1",
          800: "#1349b6",
          900: "#16408f",
          950: "#122957",
        },
        surface: {
          0: "#ffffff",
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
          950: "#020617",
        },
        danger: { 500: "#ef4444", 600: "#dc2626" },
        warning: { 500: "#f59e0b", 600: "#d97706" },
        success: { 500: "#22c55e", 600: "#16a34a" },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      boxShadow: {
        glow: "0 0 20px rgba(42, 145, 255, 0.15)",
        "glow-lg": "0 0 40px rgba(42, 145, 255, 0.2)",
      },
    },
  },
  plugins: [],
};

export default config;
