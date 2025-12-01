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
        primary: {
          DEFAULT: "#C5459C",
          50: "#FCF2F9",
          100: "#F8E2F2",
          200: "#F1C5E5",
          300: "#EAA8D8",
          400: "#DC6EBF",
          500: "#C5459C",
          600: "#B1378C",
          700: "#932B74",
          800: "#75225C",
          900: "#581A45",
          950: "#3A112E",
        },
        secondary: {
          DEFAULT: "#459CC5",
          50: "#F2F9FC",
          100: "#E2F2F8",
          200: "#C5E5F1",
          300: "#A8D8EA",
          400: "#6EBFDC",
          500: "#459CC5",
          600: "#378CB1",
          700: "#2B7493",
          800: "#225C75",
          900: "#1A4558",
          950: "#112E3A",
        },
      },
    },
  },
  plugins: [],
};
export default config;

