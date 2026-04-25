import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#08090d",
        panel: "#11131a",
        line: "rgba(255,255,255,0.11)",
        acid: "#c7ff4f",
        pulse: "#ff4f9a",
        cyan: "#55d7ff"
      },
      boxShadow: {
        glow: "0 0 44px rgba(199, 255, 79, 0.18)"
      }
    }
  },
  plugins: []
};

export default config;
