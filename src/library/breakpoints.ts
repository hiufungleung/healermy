/**
 * Centralized responsive breakpoints configuration
 *
 * These breakpoints define when the UI switches between mobile and desktop/tablet layouts.
 * The primary breakpoint is based on the hamburger menu visibility in the Layout component.
 *
 * Usage:
 * - CSS classes: Use `md:` prefix (e.g., `md:hidden`, `md:flex`)
 * - JavaScript: Use `MOBILE_BREAKPOINT` constant or `useIsMobile()` hook
 * - Media queries: Use `(max-width: ${MOBILE_BREAKPOINT - 1}px)`
 */

/**
 * Primary breakpoint: Mobile vs Desktop/Tablet
 * - Mobile: < 768px (hamburger menu shown)
 * - Desktop/Tablet: >= 768px (full navigation shown)
 *
 * Corresponds to Tailwind's `md` breakpoint
 */
export const MOBILE_BREAKPOINT = 768;

/**
 * Secondary breakpoint: Two-column layouts
 * - Single column: < 1024px
 * - Two columns: >= 1024px
 *
 * Corresponds to Tailwind's `lg` breakpoint
 * Use for content that needs side-by-side layout on larger screens
 */
export const LARGE_BREAKPOINT = 1024;

/**
 * Tailwind CSS breakpoint class prefixes
 * Use these in className strings for responsive styling
 */
export const BREAKPOINT_CLASSES = {
  /** Hide on mobile, show on desktop/tablet (>= 768px) */
  HIDE_MOBILE: 'md:hidden',
  /** Show on mobile, hide on desktop/tablet (< 768px) */
  SHOW_MOBILE: 'hidden md:block',
  /** Two-column grid at desktop/tablet (>= 768px) */
  TWO_COL_DESKTOP: 'grid-cols-1 md:grid-cols-2',
  /** Two-column grid on large screens (>= 1024px) - for content needing more space */
  TWO_COL_LARGE: 'grid-cols-1 lg:grid-cols-2',
} as const;

/**
 * Media query strings for use in matchMedia
 */
export const MEDIA_QUERIES = {
  /** Matches mobile devices (< 768px) */
  MOBILE: `(max-width: ${MOBILE_BREAKPOINT - 1}px)`,
  /** Matches desktop/tablet devices (>= 768px) */
  DESKTOP: `(min-width: ${MOBILE_BREAKPOINT}px)`,
  /** Matches large screens (>= 1024px) */
  LARGE: `(min-width: ${LARGE_BREAKPOINT}px)`,
} as const;
