export default {
  content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}'
],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#120709',
          800: '#1b0b0f',
        },
        maroon: {
          900: '#1e0a0f',
          800: '#2b0d15',
          700: '#3b1219',
          600: '#4d1a22',
        },
        parch: {
          DEFAULT: '#f7efd9',
          light: '#fbf7ea',
          mute: '#e6e3ea',
          line: '#ddd2b4',
        },
        gold: {
          DEFAULT: '#c8a94b',
          deep: '#9c7c22',
          soft: '#eee0b0',
        },
        blood: {
          DEFAULT: '#e0184f',
          deep: '#a01020',
        },
        charcoal: {
          DEFAULT: '#241a15',
          soft: '#5c4b3f',
        },
        felt: '#1c3b2b',
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 18px 40px -22px rgba(0, 0, 0, 0.9)',
        card: '0 10px 24px -12px rgba(0, 0, 0, 0.45)',
        gold: '0 0 0 1px rgba(200, 169, 75, 0.35)',
      },
      borderRadius: {
        '2.5xl': '1.375rem',
      },
    },
  },
  plugins: [],
};
