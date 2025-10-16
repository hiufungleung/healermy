import { NextRequest } from 'next/server';

/**
 * Get the actual public base URL for the application
 *
 * This handles reverse proxy scenarios where Next.js sees the internal
 * address (e.g., 0.0.0.0:3000) instead of the public domain.
 *
 * Priority order:
 * 1. BASE_URL environment variable (runtime - most reliable)
 * 2. NEXT_PUBLIC_BASE_URL environment variable (build-time)
 * 3. X-Forwarded headers from reverse proxy (Nginx/Cloudflare)
 * 4. Request URL (fallback for local development)
 *
 * @param request - Next.js request object
 * @returns The public base URL
 *
 * @example
 * ```typescript
 * // In API route or middleware
 * const baseUrl = getPublicBaseUrl(request);
 * return NextResponse.redirect(new URL('/dashboard', baseUrl));
 * ```
 */
export function getPublicBaseUrl(request: NextRequest): string {
  // Priority 1: Environment variable (most reliable for production)
  const envBaseUrl = process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL;
  if (envBaseUrl) {
    return envBaseUrl;
  }

  // Priority 2: X-Forwarded headers (from reverse proxy like Nginx/Cloudflare)
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host');

  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  // Fallback: Use request URL origin (works for local development)
  // Note: This will be 0.0.0.0:3000 behind a reverse proxy without proper headers
  const url = new URL(request.url);
  return url.origin;
}
