/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0E4D3F',
          dark: '#093328',
          light: '#157A63',
        },
        cream: '#F5EFE6',
        sand: '#EDE3D1',
        gold: '#C9A24A',
        ink: '#15201C',
        muted: '#5C6B66',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,32,28,.04), 0 8px 24px -12px rgba(15,32,28,.18)',
      },
    },
  },
  plugins: [],
}
