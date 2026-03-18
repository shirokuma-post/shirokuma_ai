import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f7ff",
          100: "#e0effe",
          200: "#bae0fd",
          300: "#7cc8fb",
          400: "#36adf6",
          500: "#0c93e7",
          600: "#0074c5",
          700: "#015da0",
          800: "#064f84",
          900: "#0b426e",
          950: "#072a49",
        },
        accent: {
          50: "#fff1f2",
          100: "#ffe0e2",
          200: "#ffc6ca",
          300: "#ff9da4",
          400: "#ff6470",
          500: "#ff3145",
          600: "#ed1130",
          700: "#c80a25",
          800: "#a50d23",
          900: "#881223",
          950: "#4b030e",
        },
      },
      fontFamily: {
        sans: [
          '"Noto Sans JP"',
          '"Inter"',
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
