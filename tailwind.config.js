/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        rose: {
          bloom: "#FF6B95",
          petal: "#FFB7C5",
        },
        lavender: "#E0DAFF",
        peach: "#FFE5D9",
        apricot: "#FFF0E5",
        "bloom-white": "#FFFAFB",
        "zumba-pink": "#FF2E63",
        "zumba-lime": "#00FF9D",
        "zumba-cyan": "#00E0FF",
        zumba: {
          dark: "#050505",
        }
      },
      fontFamily: {
        sans: ['Inter', 'Outfit', 'sans-serif'],
        display: ['Playfair Display', 'serif'],
      },
    },
  },
  plugins: [],
}
