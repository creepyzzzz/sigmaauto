/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef9ff',
          100: '#d8f1ff',
          200: '#b9e6ff',
          300: '#89d7ff',
          400: '#52bfff',
          500: '#2a9eff',
          600: '#007aff', // Apple system blue
          700: '#0062d6',
          800: '#0051b0',
          900: '#00448f',
          950: '#002959',
        }
      },
      fontFamily: {
        rounded: [
          "'SF Pro Rounded'",
          "-apple-system",
          "BlinkMacSystemFont",
          "sans-serif",
        ],
        heading: [
          "'SF Pro Rounded'",
          "-apple-system",
          "BlinkMacSystemFont",
          "'SF Pro Display'",
          "sans-serif",
        ],
        display: [
          "'SF Pro Display'",
          "-apple-system",
          "BlinkMacSystemFont",
          "'Inter'",
          "sans-serif",
        ],
        sans: [
          "'SF Pro Display'",
          "-apple-system",
          "BlinkMacSystemFont",
          "'Inter'",
          "'Segoe UI'",
          "Roboto",
          "sans-serif",
        ],
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'pulse-subtle': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
