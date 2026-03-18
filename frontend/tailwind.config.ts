import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-studio)", "system-ui", "sans-serif"],
        serif: ["var(--font-studio)", "Georgia", "serif"],
        display: ["var(--font-studio)", "system-ui", "sans-serif"],
        studio: ["var(--font-studio)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
        "studio-mono": ["var(--font-studio-mono)", "monospace"],
      },
      colors: {
        // Base colors
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",

        // Brand colors
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        purple: {
          DEFAULT: "hsl(var(--purple))",
          foreground: "hsl(var(--purple-foreground))",
        },
        gradient: {
          from: "hsl(var(--gradient-from))",
          via: "hsl(var(--gradient-via))",
          to: "hsl(var(--gradient-to))",
        },
        // Semantic colors
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

        // Component colors
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Studio dark-app palette
        studio: {
          bg: "var(--studio-bg)",
          surface: "var(--studio-surface)",
          topbar: "var(--studio-topbar)",
          accent: "var(--studio-accent)",
          purple: "var(--studio-purple)",
          fg: "var(--studio-fg)",
          border: "var(--studio-border)",
          ring: "var(--studio-ring)",
        },
        // Surface scale
        "surface-0":   "hsl(var(--surface-0))",
        "surface-1":   "hsl(var(--surface-1))",
        "surface-2":   "hsl(var(--surface-2))",
        "surface-top": "hsl(var(--surface-top))",
        // Text dim scale (full CSS values with alpha)
        "dim-1": "var(--text-dim-1)",
        "dim-2": "var(--text-dim-2)",
        "dim-3": "var(--text-dim-3)",
        // Status colors
        success: "hsl(var(--color-success))",
        warning: "hsl(var(--color-warning))",
        error:   "hsl(var(--color-error))",
        info:    "hsl(var(--color-info))",
        // Overlay scale (white glass layers)
        "overlay-xs": "var(--overlay-xs)",
        "overlay-sm": "var(--overlay-sm)",
        "overlay-md": "var(--overlay-md)",
        "overlay-lg": "var(--overlay-lg)",
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background, var(--background)))",
          foreground: "hsl(var(--sidebar-foreground, var(--foreground)))",
          accent: "hsl(var(--sidebar-accent, var(--accent)))",
          "accent-foreground":
            "hsl(var(--sidebar-accent-foreground, var(--accent-foreground)))",
          border: "hsl(var(--sidebar-border, var(--border)))",
          ring: "hsl(var(--sidebar-ring, var(--ring)))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
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
        "gen-bar": {
          "0%": { width: "0" },
          "100%": { width: "100%" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "gen-bar": "gen-bar 2.2s ease forwards",
        shimmer: "shimmer 1.5s infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
