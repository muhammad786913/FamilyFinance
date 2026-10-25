/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./pages/**/*.{js,jsx}", "./components/**/*.{js,jsx}", "./app/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        powder: "#D9E8F5",
        soft: "#AFC8DF",
        cyan: "#00A6D6",
        bg: "#F0F4F8",
        navy: "#24364B",
      },
    },
  },
  plugins: [],
};
