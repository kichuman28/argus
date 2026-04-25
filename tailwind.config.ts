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
        ink: "#07080a",
        panel: "#10131a",
        line: "rgba(255,255,255,0.11)",
        acid: "#adff4c",
        pulse: "#ff4f7a",
        cyan: "#55d7ff"
      },
      boxShadow: {
        glow: "0 0 34px rgba(173, 255, 76, 0.18)"
      }
    }
  },
  plugins: []
};

export default config;
