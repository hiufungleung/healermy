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
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		animation: {
  			shimmer: 'shimmer 2s infinite linear',
  			'spin-once': 'spin-once 0.5s ease-in-out',
  			'spin-reverse': 'spin 1s linear infinite reverse',
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
  		},
  		typography: {
  			// Custom typography scale for consistent font sizes
  			'display-lg': ['2.5rem', { lineHeight: '1.2', fontWeight: '700' }],  // 40px
  			'display': ['2rem', { lineHeight: '1.25', fontWeight: '700' }],      // 32px
  			'h1': ['1.875rem', { lineHeight: '1.3', fontWeight: '700' }],        // 30px
  			'h2': ['1.5rem', { lineHeight: '1.35', fontWeight: '600' }],         // 24px
  			'h3': ['1.25rem', { lineHeight: '1.4', fontWeight: '600' }],         // 20px
  			'h4': ['1.125rem', { lineHeight: '1.45', fontWeight: '600' }],       // 18px
  			'body-lg': ['1rem', { lineHeight: '1.6', fontWeight: '400' }],       // 16px
  			'body': ['0.875rem', { lineHeight: '1.6', fontWeight: '400' }],      // 14px
  			'body-sm': ['0.8125rem', { lineHeight: '1.5', fontWeight: '400' }],  // 13px
  			'caption': ['0.75rem', { lineHeight: '1.5', fontWeight: '400' }],    // 12px
  		}
  	}
  },
  plugins: [
    tailwindForms,
    tailwindTypography,
      require("tailwindcss-animate"),
    // Custom typography plugin for utility classes
    function({ addComponents }: any) {
      addComponents({
        '.typo-display-lg': {
          '@apply text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold': {},
        },
        '.typo-display': {
          '@apply text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold': {},
        },
        '.typo-h1': {
          '@apply text-2xl sm:text-3xl font-bold': {},
        },
        '.typo-h2': {
          '@apply text-xl sm:text-2xl font-semibold': {},
        },
        '.typo-h3': {
          '@apply text-base sm:text-lg md:text-xl font-semibold': {},
        },
        '.typo-h4': {
          '@apply text-sm sm:text-base md:text-lg font-semibold': {},
        },
        '.typo-body-lg': {
          '@apply text-base sm:text-lg': {},
        },
        '.typo-body': {
          '@apply text-sm sm:text-base': {},
        },
        '.typo-body-sm': {
          '@apply text-xs sm:text-sm': {},
        },
        '.typo-caption': {
          '@apply text-xs': {},
        },
      })
    }
],
};

export default config;