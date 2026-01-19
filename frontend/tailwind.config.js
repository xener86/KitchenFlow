/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
      },
      colors: {
        kitchen: {
          50: '#fefbf6',
          100: '#fdf4e7',
          200: '#fbe5c8',
          300: '#f7cfa0',
          400: '#f2b16d',
          500: '#eb8f3c',
          600: '#dc7124',
          700: '#b7561c',
          800: '#934517',
          900: '#783a16',
          950: '#411c09',
        }
      }
    },
  },
  plugins: [],
}
