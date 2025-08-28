/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        twitan: {
          "primary": "#10b981",         // emerald vibe
          "secondary": "#3b82f6",       // accent blue
          "accent": "#f59e0b",          // sporty highlight
          "neutral": "#1f2937",         // dark slate
          "base-100": "#0b1220",        // deep navy background
          "base-200": "#111827",
          "base-300": "#1f2937",
          "info": "#38bdf8",
          "success": "#22c55e",
          "warning": "#f59e0b",
          "error": "#ef4444",
        }
      },
      "emerald"
    ],
  },
}
