import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        orange: {
          DEFAULT: "#F56B22",
          600:     "#E25A12",
          700:     "#C84A05",
          50:      "#FFF1E6",
          100:     "#FEE2CB",
        },
        yellow: {
          DEFAULT: "#FFB54B",
          50:      "#FFF6E5",
        },
        navy: {
          DEFAULT: "#131C4E",
          700:     "#1F2960",
          500:     "#3A4382",
          100:     "#E5E7F1",
          50:      "#F1F2F8",
        },
        surface: {
          DEFAULT: "#F1F2F8",
          card:    "#FFFFFF",
          border:  "#E5E7F1",
          muted:   "#F8F9FC",
        },
        ink: {
          DEFAULT: "#131C4E",
          muted:   "#3A4382",
          faint:   "#7B82AA",
          placeholder: "#A8AECB",
        },
        status: {
          green:  "#10B981",
          amber:  "#F59E0B",
          red:    "#EF4444",
          blue:   "#3B82F6",
          purple: "#8B5CF6",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl2: "1rem",
        xl3: "1.5rem",
      },
      boxShadow: {
        card:   "0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)",
        card2:  "0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05)",
        popup:  "0 20px 25px -5px rgba(0,0,0,0.10), 0 8px 10px -6px rgba(0,0,0,0.04)",
      },
      backgroundImage: {
        "gradient-sunset": "linear-gradient(135deg, #F56B22 0%, #FFB54B 100%)",
        "gradient-navy":   "linear-gradient(135deg, #131C4E 0%, #1F2960 100%)",
        "gradient-warm":   "linear-gradient(135deg, #F56B22 0%, #E25A12 100%)",
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-in": "slideIn 0.25s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4,0,0.6,1) infinite",
      },
      keyframes: {
        fadeIn:  { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideIn: { "0%": { opacity: "0", transform: "translateY(8px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
      },
    },
  },
  plugins: [],
};
export default config;
