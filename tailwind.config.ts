import type { Config } from "tailwindcss";
import tailwindForms from '@tailwindcss/forms';
import tailwindTypography from '@tailwindcss/typography';

const config: Config = {
    darkMode: ["class"],
    content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		fontFamily: {
  			sans: [
  				'Lexend',
  				'system-ui',
  				'sans-serif'
  			]
  		},
  		colors: {
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				hover: '#60A5FA',
  				active: '#1E40AF',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			brand: '#2E4EF4',
  			danger: {
  				DEFAULT: '#EF4444',
  				hover: '#DC2626',
  				active: '#B91C1C'
  			},
  			success: '#22C55E',
  			warning: '#FFC107',
  			background: 'hsl(var(--background))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			'text-primary': '#1F2937',
  			'text-secondary': '#6B7280',
  			foreground: 'hsl(var(--foreground))',
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		animation: {
  			shimmer: 'shimmer 2s infinite linear',
  			'spin-once': 'spin-once 0.5s ease-in-out',
  			'color-pulse': 'color-pulse 1s infinite alternate',
  			'gentle-bounce': 'gentle-bounce 0.8s infinite ease-in-out',
  			'gentle-shake': 'gentle-shake 0.6s infinite ease-in-out',
  			'swing-once': 'swing-once 0.8s ease-in-out'
  		},
  		keyframes: {
  			shimmer: {
  				'0%': {
  					backgroundPosition: '-1000px 0'
  				},
  				'100%': {
  					backgroundPosition: '1000px 0'
  				}
  			},
  			'spin-once': {
  				'0%': {
  					transform: 'rotate(0deg)'
  				},
  				'100%': {
  					transform: 'rotate(360deg)'
  				}
  			},
  			'color-pulse': {
  				'0%': {
  					color: '#F97316'
  				},
  				'100%': {
  					color: '#DC2626'
  				}
  			},
  			'gentle-bounce': {
  				'0%, 100%': {
  					transform: 'translateY(0)'
  				},
  				'50%': {
  					transform: 'translateY(-3px)'
  				}
  			},
  			'gentle-shake': {
  				'0%, 100%': {
  					transform: 'translateX(0)'
  				},
  				'25%': {
  					transform: 'translateX(-2px)'
  				},
  				'75%': {
  					transform: 'translateX(2px)'
  				}
  			},
  			'swing-once': {
  				'0%': {
  					transform: 'rotate(0deg)'
  				},
  				'20%': {
  					transform: 'rotate(15deg)'
  				},
  				'40%': {
  					transform: 'rotate(-10deg)'
  				},
  				'60%': {
  					transform: 'rotate(5deg)'
  				},
  				'80%': {
  					transform: 'rotate(-2deg)'
  				},
  				'100%': {
  					transform: 'rotate(0deg)'
  				}
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		}
  	}
  },
  plugins: [
    tailwindForms,
    tailwindTypography,
      require("tailwindcss-animate")
],
};

export default config;