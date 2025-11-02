/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#0a0a0a',
          card: '#1a1a1a',
          'card-hover': '#222222',
          border: '#2a2a2a',
          text: {
            primary: '#ffffff',
            secondary: '#a0a0a0',
            muted: '#707070',
          }
        },
        accent: {
          green: '#22c55e',      // Tailwind green-500
          'green-hover': '#4ade80',  // Tailwind green-400
          'green-dark': '#16a34a',   // Tailwind green-600
        }
      }
    },
  },
  plugins: [],
}
