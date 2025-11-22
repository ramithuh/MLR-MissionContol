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
          bg: 'var(--bg-primary)',
          card: 'var(--bg-card)',
          'card-hover': 'var(--bg-card-hover)',
          border: 'var(--border-color)',
          text: {
            primary: 'var(--text-primary)',
            secondary: 'var(--text-secondary)',
            muted: 'var(--text-muted)',
          }
        },
        accent: {
          green: 'var(--accent-green)',
          'green-hover': 'var(--accent-green-hover)',
          'green-dark': 'var(--accent-green-dark)',
        }
      }
    },
  },
  plugins: [],
}
