/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        taco: {
          DEFAULT: "#e85d2f",
          dark: "#c74a20",
        },
      },
    },
  },
  plugins: [],
};
