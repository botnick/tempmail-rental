import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/config/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        base: '#0d0a07',
        surface: '#161210',
        elevated: '#1e1914',
        brand: {
          DEFAULT: '#f97316',
          bright: '#fb923c',
          deep: '#ea580c',
          glow: '#fdba74',
          soft: '#fed7aa',
        },
        amber: '#f59e0b',
        gold: '#eab308',
        coral: '#f87171',
        peach: '#fbbf80',
        apricot: '#fdba74',
        tangerine: '#fb923c',
        'warm-rose': '#fb7185',
        'accent-teal': '#2dd4bf',
        'accent-sky': '#7dd3fc',
        success: '#34d399',
        warning: '#fbbf24',
        danger: '#ef4444',
        text: {
          primary: '#fef3e2',
          secondary: '#d4b896',
          muted: '#8b7355',
        },
        border: {
          subtle: 'rgba(251, 146, 60, 0.08)',
          warm: 'rgba(251, 146, 60, 0.15)',
        },
      },
      fontFamily: {
        sans: ['LINE Seed Sans TH', 'system-ui', 'Noto Sans Thai', 'sans-serif'],
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.65s cubic-bezier(0.16,1,0.3,1) both',
        'fade-in': 'fadeIn 0.2s ease-out both',
        'slide-in-right': 'slideInRight 0.3s cubic-bezier(0.16,1,0.3,1) both',
      },
      keyframes: {
        fadeInUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideInRight: {
          from: { opacity: '0', transform: 'translateX(100%)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
