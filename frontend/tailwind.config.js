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
          green: '#76B900',
          'green-hover': '#88cc00',
          'green-dark': '#5a8f00',
        }
      }
    },
  },
  plugins: [],
}
