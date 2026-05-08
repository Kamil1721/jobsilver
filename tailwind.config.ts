import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Status colors for 3-column system
        status: {
          new: "hsl(var(--status-new))",
          applied: "hsl(var(--status-applied))",
          offer: "hsl(var(--status-offer))",
        },
        // Cyan accent shades
        cyan: {
          50: "hsl(var(--cyan-50))",
          100: "hsl(var(--cyan-100))",
          200: "hsl(var(--cyan-200))",
          300: "hsl(var(--cyan-300))",
          400: "hsl(var(--cyan-400))",
          500: "hsl(var(--cyan-500))",
          600: "hsl(var(--cyan-600))",
          700: "hsl(var(--cyan-700))",
          800: "hsl(var(--cyan-800))",
          900: "hsl(var(--cyan-900))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        serif: ["var(--font-fraunces)", "Fraunces", "Times New Roman", "Georgia", "serif"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "1rem" }],
      },
      letterSpacing: {
        tighter: "-0.02em",
        tight: "-0.01em",
      },
      animation: {
        "pulse-subtle": "pulse-subtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fade-in 0.2s ease-out forwards",
        "fade-in-up": "fade-in-up 0.3s ease-out forwards",
        "slide-in-right": "slide-in-right 0.2s ease-out forwards",
        "js-mesh-drift": "js-mesh-drift 90s ease-in-out infinite",
        "js-chrome-sweep": "js-chrome-sweep 6s linear infinite",
        "js-deal": "js-deal 600ms cubic-bezier(0.16, 1, 0.3, 1) both",
      },
      keyframes: {
        "pulse-subtle": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.9", transform: "scale(1.01)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(8px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "js-mesh-drift": {
          "0%, 100%": { transform: "translate(0%, 0%) rotate(0deg) scale(1)" },
          "50%": { transform: "translate(-5%, 4%) rotate(2.5deg) scale(1.04)" },
        },
        "js-chrome-sweep": {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "200% 50%" },
        },
        "js-deal": {
          "0%": { opacity: "0", transform: "translateY(28px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
      },
      transitionDuration: {
        "150": "150ms",
        "200": "200ms",
        "250": "250ms",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
export default config
