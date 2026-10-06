import type { Config } from 'tailwindcss';

/**
 * Brand tokens sampled from reference/logo.jpeg.
 * red #C81010 · gold #E1A10C · green #1E6131 · cream #FCF7F1 · ink #0B0B0B
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#0B0B0B', 900: '#0B0B0B', 800: '#141414', 700: '#1E1E1E', 600: '#2A2A2A' },
        cream: { DEFAULT: '#FCF7F1', 100: '#FCF7F1', 200: '#F4ECE1', 300: '#E8DCCB' },
        'ghana-red': {
          DEFAULT: '#C81010', 50: '#FDECEC', 100: '#FAD0D0', 200: '#F3A1A1', 300: '#EA6B6B',
          400: '#DE3838', 500: '#C81010', 600: '#A70D0D', 700: '#860A0A', 800: '#640808', 900: '#430505',
        },
        'ghana-gold': {
          DEFAULT: '#E1A10C', 50: '#FDF6E3', 100: '#FAEAC0', 200: '#F5D684', 300: '#EFC24A',
          400: '#E8B126', 500: '#E1A10C', 600: '#B88309', 700: '#8C6407', 800: '#634705', 900: '#3D2B03',
        },
        'ghana-green': {
          DEFAULT: '#1E6131', 50: '#E8F3EB', 100: '#C9E4D0', 200: '#94C8A2', 300: '#5FAB75',
          400: '#348A4D', 500: '#1E6131', 600: '#194F28', 700: '#133D1F', 800: '#0D2B16', 900: '#07190C',
        },
      },
      fontFamily: {
        display: ['"Clash Display"', '"Inter Tight"', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)',
        lift: '0 20px 40px -12px rgba(0,0,0,.45)',
      },
      keyframes: {
        'kente-slide': { from: { backgroundPosition: '0 0' }, to: { backgroundPosition: '96px 0' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: { 'kente-slide': 'kente-slide 6s linear infinite' },
    },
  },
  plugins: [],
} satisfies Config;
