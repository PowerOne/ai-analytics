import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@tremor/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@tremor/react/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        risk: {
          low: "#22c55e",
          medium: "#eab308",
          high: "#ef4444",
        },
      },
    },
  },
  plugins: [],
};

export default config;
