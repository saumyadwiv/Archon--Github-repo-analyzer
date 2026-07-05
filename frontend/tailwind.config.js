/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        canvas: '#0A0C10',
        surface: '#12151C',
        'surface-2': '#181C25',
        border: '#232733',
        'border-light': '#2C3140',
        muted: '#8B92A3',
        foreground: '#E7E9EE',
        brand: {
          DEFAULT: '#6E5BFF',
          light: '#8B7BFF',
          dark: '#5647CC',
          muted: '#6E5BFF1A',
        },
        cycle: {
          DEFAULT: '#F0466E',
          muted: '#F0466E22',
        },
        grade: {
          a: '#34D399',
          b: '#7DD3A0',
          c: '#F5A623',
          d: '#F0813E',
          f: '#F0466E',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        lg: '0.75rem',
        md: '0.5rem',
        sm: '0.375rem',
      },
      keyframes: {
        'pulse-slow': {
          '0%, 100%': { opacity: 0.4 },
          '50%': { opacity: 0.9 },
        },
        'draw-line': {
          from: { strokeDashoffset: 400 },
          to: { strokeDashoffset: 0 },
        },
        'fade-up': {
          from: { opacity: 0, transform: 'translateY(8px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
      },
      animation: {
        'pulse-slow': 'pulse-slow 3s ease-in-out infinite',
        'draw-line': 'draw-line 2s ease-out forwards',
        'fade-up': 'fade-up 0.5s ease-out forwards',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
