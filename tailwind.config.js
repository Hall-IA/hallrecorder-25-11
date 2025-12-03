/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        roboto: ['Roboto', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        inter: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        thunder: ['Thunder', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        azeret: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        base: ['16px', { lineHeight: '1.6' }],
      },
      colors: {
        background: 'var(--color-background)',
        foreground: 'var(--color-foreground)',
        border: 'var(--color-border)',
        input: 'var(--color-input)',
        ring: 'var(--color-ring)',
        primary: {
          DEFAULT: 'var(--color-primary)',
          foreground: 'var(--color-primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--color-secondary)',
          foreground: 'var(--color-secondary-foreground)',
        },
        muted: {
          DEFAULT: 'var(--color-muted)',
          foreground: 'var(--color-muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          foreground: 'var(--color-accent-foreground)',
        },
        silverchalice: {
          50: 'var(--color-silverchalice-50)',
          100: 'var(--color-silverchalice-100)',
          200: 'var(--color-silverchalice-200)',
          300: 'var(--color-silverchalice-300)',
          400: 'var(--color-silverchalice-400)',
          500: 'var(--color-silverchalice-500)',
          600: 'var(--color-silverchalice-600)',
          700: 'var(--color-silverchalice-700)',
          800: 'var(--color-silverchalice-800)',
          900: 'var(--color-silverchalice-900)',
        },
        coral: {
          50: '#fff5f3',
          100: '#ffe8e3',
          200: '#ffd5cc',
          300: '#ffb8a8',
          400: '#ff8f73',
          500: '#FF5F4F',
          600: '#f03d2d',
          700: '#d42c1c',
          800: '#b02618',
          900: '#91241a',
        },
        sunset: {
          50: '#fff8ed',
          100: '#ffefd4',
          200: '#ffdca8',
          300: '#ffc271',
          400: '#ff9d38',
          500: '#FFB63A',
          600: '#f09020',
          700: '#c76f17',
          800: '#9f5818',
          900: '#804a17',
        },
        cocoa: {
          50: '#f7f3f2',
          100: '#e9e0dd',
          200: '#d4c0ba',
          300: '#ba9c93',
          400: '#a17c70',
          500: '#8c6658',
          600: '#6d4e42',
          700: '#4d3520',
          800: '#44311e',
          900: '#3d2c1c',
        },
        peach: {
          50: '#fff9f5',
          100: '#fff3ed',
          200: '#ffe4d4',
          300: '#ffd0b3',
          400: '#ffb088',
          500: '#ff9566',
          600: '#f7744a',
          700: '#e85633',
          800: '#c54426',
          900: '#a33920',
        },
      },
      animation: {
        'pulse-soft': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-soft': 'bounce 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'fadeInUp': 'fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
        'fadeInDown': 'fadeInDown 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
        'fadeInLeft': 'fadeInLeft 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
        'fadeInRight': 'fadeInRight 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
        'zoomIn': 'zoomIn 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        'marquee': 'marquee var(--duration) linear infinite',
        'marquee-vertical': 'marquee-vertical var(--duration) linear infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        fadeInRight: {
          '0%': { opacity: '0', transform: 'translateX(30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        zoomIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        marquee: {
          'from': { transform: 'translateX(0)' },
          'to': { transform: 'translateX(calc(-100% - var(--gap)))' },
        },
        'marquee-vertical': {
          'from': { transform: 'translateY(0)' },
          'to': { transform: 'translateY(calc(-100% - var(--gap)))' },
        },
      },
      animationDelay: {
        '75': '75ms',
        '100': '100ms',
        '150': '150ms',
        '200': '200ms',
        '300': '300ms',
        '400': '400ms',
        '500': '500ms',
        '600': '600ms',
        '700': '700ms',
        '800': '800ms',
        '900': '900ms',
        '1000': '1000ms',
      },
      spacing: {
        '15': '3.75rem', // 60px
        '30': '7.5rem', // 120px
        '50': '12.5rem', // 200px
        '60': '15rem', // 240px
        '70': '17.5rem', // 280px
        '90': '22.5rem', // 360px
      },
    },
  },
  plugins: [],
};
