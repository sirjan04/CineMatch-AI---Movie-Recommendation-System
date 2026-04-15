/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#0a0b0f",
        surface: "#12141a",
        elevated: "#1a1d26",
        line: "rgba(255,255,255,0.08)",
        mist: "#9ca3b8",
        glow: "#5eead4",
        pop: "#f472b6",
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "system-ui", "sans-serif"],
        display: ["Syne", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 4px 24px rgba(0,0,0,0.35)",
        glow: "0 0 40px rgba(94,234,212,0.12)",
      },
    },
  },
  plugins: [],
};
