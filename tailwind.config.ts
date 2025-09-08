import type { Config } from "tailwindcss";

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
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
};

export default config;