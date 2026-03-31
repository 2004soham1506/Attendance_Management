module.exports = {
  content: ["./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Clash Display'", "'DM Sans'", "sans-serif"],
        body:    ["'DM Sans'", "sans-serif"],
        mono:    ["'JetBrains Mono'", "monospace"],
      },
      colors: {
        ink:  "#0A0C10",
        card: "#111318",
        edge: "#1E2130",
        dim:  "#3A4060",
        soft: "#6B7499",
        mist: "#A8B0CC",
        snow: "#E8EBF5",
        // accent
        azure: {
          400: "#60A5FA",
          500: "#3B82F6",
          600: "#2563EB",
        },
        jade: {
          400: "#34D399",
          500: "#10B981",
        },
        amber: {
          400: "#FBBF24",
          500: "#F59E0B",
        },
        rose: {
          400: "#FB7185",
          500: "#F43F5E",
        },
        violet: {
          400: "#A78BFA",
          500: "#8B5CF6",
        },
      },
      boxShadow: {
        glow:  "0 0 24px rgba(59,130,246,0.15)",
        card:  "0 1px 3px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)",
        float: "0 8px 32px rgba(0,0,0,0.4)",
      },
      animation: {
        "slide-up":   "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) forwards",
        "fade-in":    "fadeIn 0.3s ease forwards",
        "pulse-ring": "pulseRing 2s ease-in-out infinite",
        "spin-slow":  "spin 3s linear infinite",
      },
      keyframes: {
        slideUp: {
          from: { opacity: 0, transform: "translateY(20px)" },
          to:   { opacity: 1, transform: "translateY(0)" },
        },
        fadeIn: {
          from: { opacity: 0 },
          to:   { opacity: 1 },
        },
        pulseRing: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(59,130,246,0.4)" },
          "50%":      { boxShadow: "0 0 0 12px rgba(59,130,246,0)" },
        },
      },
    },
  },
  plugins: [],
};
