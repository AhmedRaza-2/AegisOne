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
          50: "#F0F6FA",
          100: "#E4EEF6",
          200: "#B3CFE5",
          300: "#8CA3B8",
          400: "#5C93BE",
          500: "#4A7FA7", // primary brand blue
          600: "#3D6C90",
          700: "#2E5580",
          800: "#24466E",
          900: "#1A3D63",
          950: "#0A1931",
        },
        surface: {
          0: "#ffffff",
          50: "#F6FAFD", // canvas background
          100: "#E1EBF2",
          200: "#C7DAE8",
          300: "#8CA3B8",
          400: "#6B87A0",
          500: "#4A6D8C",
          600: "#2E5580",
          700: "#24466E",
          800: "#1A3D63",
          900: "#0A1931",
          950: "#071426",
        },
        // 60-30-10: surface = 60% canvas, brand navy = 30% structure, accent violet = 10% (only things you click)
        accent: {
          50: "#F4F1FF",
          100: "#E9E3FF",
          200: "#D3C8FF",
          300: "#B4A2FF",
          400: "#9179FF",
          500: "#7C5FFF",
          600: "#6D4CFF", // CTA (white text 5.1:1)
          700: "#5935EB",
          800: "#4627C2",
          900: "#341D8F",
        },
        danger: { 500: "#D65C5C", 600: "#B33E3E" },
        warning: { 500: "#D9A441", 600: "#B3822B" },
        success: { 500: "#2FA97E", 600: "#238260" },
      },
      fontFamily: {
        sans: ["Outfit", "Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      boxShadow: {
        glow: "0 0 20px rgba(74, 127, 167, 0.15)",
        "glow-lg": "0 0 40px rgba(74, 127, 167, 0.2)",
      },
    },
  },
  plugins: [],
};

export default config;
