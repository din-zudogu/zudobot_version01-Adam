import type { Config } from "tailwindcss";

// ZUDOBOT Design System — Minimalist Luxury (Blue & Gold)
// All new screens MUST use these tokens. No custom colors outside this palette.
const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand — Primary (Blue: tech, trust, intelligence)
        brand: {
          50:  "#EFF6FF",
          100: "#DBEAFE",
          200: "#BFDBFE",
          300: "#93C5FD",
          400: "#4A90E2",
          500: "#1E5BC6",   // --blue (primary buttons, nav)
          600: "#1A4FA8",
          700: "#163F8A",
          800: "#0D2D6B",
          900: "#0D1829",   // --text-primary
          950: "#07101F",
        },
        // Accent — Gold (luxury, premium, upgrade CTA only)
        gold: {
          50:  "#FFFBEB",
          100: "#FEF3C7",
          200: "#FDE68A",
          300: "#FCD34D",
          400: "#F5A623",   // --gold-light (subtle highlights)
          500: "#B86B00",   // --gold (premium badges, upgrade CTA)
          600: "#9A5A00",
          700: "#7C4800",
          800: "#5E3700",
          900: "#3D2300",
        },
        // Cyan — secondary accent (gradient partner)
        cyan: {
          50:  "#ECFEFF",
          100: "#CFFAFE",
          400: "#00C8E8",   // --cyan-light
          500: "#007E9E",   // --cyan
          600: "#006680",
        },
        // Surfaces
        surface: {
          DEFAULT: "#FFFFFF",       // --bg-primary
          secondary: "#F0F6FF",     // --bg-secondary (slightly blue-tinted)
          card: "#FFFFFF",          // --bg-card
          "card-hover": "#EBF4FF",  // --bg-card-hover
        },
        // Text
        text: {
          primary:   "#0D1829",   // --text-primary
          secondary: "#2E4A6E",   // --text-secondary
          muted:     "#6B7FA3",   // --text-muted
        },
        // Semantic
        border: {
          DEFAULT: "rgba(13,24,41,0.10)",
          gold:    "rgba(180,100,0,0.22)",
          cyan:    "rgba(0,140,175,0.25)",
        },
        // shadcn/ui compatibility tokens
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "#1E5BC6",
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#F0F6FF",
          foreground: "#0D1829",
        },
        muted: {
          DEFAULT: "#F0F6FF",
          foreground: "#6B7FA3",
        },
        accent: {
          DEFAULT: "#B86B00",
          foreground: "#FFFFFF",
        },
        destructive: {
          DEFAULT: "#DC2626",
          foreground: "#FFFFFF",
        },
        card: {
          DEFAULT: "#FFFFFF",
          foreground: "#0D1829",
        },
        popover: {
          DEFAULT: "#FFFFFF",
          foreground: "#0D1829",
        },
        input: "#E2E8F0",
        ring: "#1E5BC6",
      },
      fontFamily: {
        heading: ["Outfit", "Sarabun", "sans-serif"],
        body:    ["Sarabun", "Outfit", "sans-serif"],
        sans:    ["Sarabun", "Outfit", "sans-serif"],
      },
      borderRadius: {
        lg: "16px",
        md: "12px",
        sm: "8px",
        xl: "20px",
        "2xl": "24px",
        DEFAULT: "16px",
      },
      boxShadow: {
        card:    "0 2px 16px rgba(13,24,41,0.06)",
        gold:    "0 0 48px rgba(180,100,0,0.15)",
        cyan:    "0 0 48px rgba(0,140,175,0.15)",
        brand:   "0 0 48px rgba(30,91,198,0.15)",
        "card-hover": "0 8px 32px rgba(13,24,41,0.12)",
        glass:   "0 4px 24px rgba(13,24,41,0.08)",
        "inner-gold": "inset 0 1px 0 rgba(245,166,35,0.2)",
      },
      backgroundImage: {
        "grad-gold":  "linear-gradient(135deg, #B86B00, #F5A623)",
        "grad-blue":  "linear-gradient(135deg, #1E5BC6, #00C8E8)",
        "grad-cyan":  "linear-gradient(135deg, #007E9E, #00C8E8)",
        "grad-hero":  "linear-gradient(135deg, #0D1829 0%, #1E3A6B 50%, #0D2D6B 100%)",
        "grad-card":  "linear-gradient(135deg, rgba(30,91,198,0.05), rgba(0,200,232,0.05))",
        "grad-surface": "linear-gradient(180deg, #FFFFFF 0%, #F0F6FF 100%)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-16px)" },
        },
        blob: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "33%": { transform: "translate(24px, -32px) scale(1.06)" },
          "66%": { transform: "translate(-18px, 18px) scale(0.94)" },
        },
        "gradient-pan": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.4s cubic-bezier(0.4,0,0.2,1)",
        "slide-in": "slide-in 0.3s cubic-bezier(0.4,0,0.2,1)",
        shimmer: "shimmer 2s linear infinite",
        float: "float 6s ease-in-out infinite",
        blob: "blob 14s ease-in-out infinite",
        "gradient-pan": "gradient-pan 10s ease-in-out infinite",
        "fade-in-up": "fade-in-up 0.6s cubic-bezier(0.4,0,0.2,1) both",
      },
    },
  },
  plugins: [],
};

export default config;
