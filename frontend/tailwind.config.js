/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Midnight Iris - Primary
        iris: {
          50: '#EEEEF6',
          100: '#D8D7ED',
          200: '#ACACD4',
          300: '#8280BB',
          400: '#5C5AB2',
          500: '#4A489A',
          600: '#3D3B8E',
          700: '#2F2D6E',
          800: '#22214F',
          900: '#151430',
        },
        // Warm Copper - Accent
        copper: {
          400: '#E8956A',
          500: '#D97C4D',
          600: '#C46A3A',
          // 700/800: AA-compliant with white text (4.5:1+) - use for filled
          // buttons and for copper text on light backgrounds.
          700: '#A8542C',
          800: '#8F4523',
        },
        // Warm Neutrals
        warm: {
          50: '#FDFBF7',
          100: '#F7F5F0',
          200: '#EDEAE3',
          300: '#D8D5CE',
          400: '#A09D96',
          500: '#6B6B76',
          600: '#52525B',
          700: '#3F3F46',
          800: '#2A2A32',
          900: '#1A1A1F',
        },
      },
      animation: {
        'fade-up': 'fadeUp 0.5s ease-out forwards',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
