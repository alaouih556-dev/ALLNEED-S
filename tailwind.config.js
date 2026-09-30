/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#dae5ff',
          200: '#bcd0ff',
          300: '#8eb1ff',
          400: '#5986fb',
          500: '#3460f4',
          600: '#1f3fe6',
          700: '#1a2ecb',
          800: '#1c2aa2',
          900: '#1c2c7f',
          950: '#121b4d',
        },
        ink: {
          50: '#f6f7f9',
          100: '#eceef2',
          200: '#d4d9e2',
          300: '#aeb6c6',
          400: '#818ca4',
          500: '#626e88',
          600: '#4d576e',
          700: '#3f4759',
          800: '#373d4b',
          900: '#181c26',
          950: '#0c0f16',
        },
        sand: {
          50: '#fdfaf5',
          100: '#f8f1e6',
          200: '#efe1cb',
          300: '#e2cba5',
          400: '#d3ab76',
          500: '#c78f4f',
          600: '#b0763b',
          700: '#8f5c31',
          800: '#754b2c',
          900: '#623f29',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Instrument Serif"', 'Inter', 'ui-serif', 'Georgia', 'serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(12,15,22,.04), 0 12px 32px -12px rgba(12,15,22,.12)',
        lift: '0 2px 4px rgba(12,15,22,.05), 0 24px 56px -20px rgba(12,15,22,.25)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'fade-up': 'fade-up .5s cubic-bezier(.22,1,.36,1) both',
        'fade-in': 'fade-in .4s ease both',
      },
    },
  },
  plugins: [],
}
