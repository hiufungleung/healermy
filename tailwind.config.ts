import type { Config } from "tailwindcss";
import tailwindForms from '@tailwindcss/forms';
import tailwindTypography from '@tailwindcss/typography';

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Lexend', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#3B82F6',
          hover: '#60A5FA',
          active: '#1E40AF',
        },
        brand: '#2E4EF4',
        danger: {
          DEFAULT: '#EF4444',
          hover: '#DC2626',
          active: '#B91C1C',
        },
        success: '#22C55E',
        warning: '#FFC107',
        background: '#F9F9F9',
        card: '#FFFFFF',
        'text-primary': '#1F2937',
        'text-secondary': '#6B7280',
      },
      animation: {
        shimmer: 'shimmer 2s infinite linear',
        'spin-once': 'spin-once 0.5s ease-in-out',
        'color-pulse': 'color-pulse 1s infinite alternate',
        'gentle-bounce': 'gentle-bounce 0.8s infinite ease-in-out',
        'gentle-shake': 'gentle-shake 0.6s infinite ease-in-out',
        'swing-once': 'swing-once 0.8s ease-in-out',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        'spin-once': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'color-pulse': {
          '0%': { color: '#F97316' },
          '100%': { color: '#DC2626' },
        },
        'gentle-bounce': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-3px)' },
        },
        'gentle-shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-2px)' },
          '75%': { transform: 'translateX(2px)' },
        },
        'swing-once': {
          '0%': { transform: 'rotate(0deg)' },
          '20%': { transform: 'rotate(15deg)' },
          '40%': { transform: 'rotate(-10deg)' },
          '60%': { transform: 'rotate(5deg)' },
          '80%': { transform: 'rotate(-2deg)' },
          '100%': { transform: 'rotate(0deg)' },
        },
      },
    },
  },
  plugins: [
    tailwindForms,
    tailwindTypography,
  ],
};

export default config;