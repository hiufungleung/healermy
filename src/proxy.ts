import { NextRequest, NextResponse } from 'next/server';
import { SessionData } from '@/types/auth';
import { decrypt, encrypt } from '@/library/auth/encryption';
import { refreshAccessToken, TokenRefreshError } from '@/library/auth/tokenRefresh';
import { TOKEN_COOKIE_NAME } from '@/library/auth/config';
import { getPublicBaseUrl } from '@/library/request-utils';

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  console.log(`🚀 [PROXY START] ${new Date().toISOString()} - ${pathname}`);

  // Skip middleware for public routes and API routes that don't need auth
  const isPublicRoute = [
      '/launch',
      '/auth/callback',
      '/api/auth',
      '/_next',
      '/favicon.ico',
    ].some(path => request.nextUrl.pathname.startsWith(path));

  if (isPublicRoute) {
    console.log(`✅ [PROXY] Public route, skipping: ${pathname}`);
    return NextResponse.next();
  }

  // Special handling for index page "/" - check if user is already authenticated
  if (pathname === '/') {
    console.log(`📍 [PROXY] Processing homepage request`);
    const tokenCookie = request.cookies.get(TOKEN_COOKIE_NAME);
    console.log(`🍪 [PROXY] Token cookie present: ${!!tokenCookie}`);

    // If user has valid session cookie, redirect to appropriate dashboard
    if (tokenCookie) {
      try {
        console.log(`🔐 [PROXY] Decrypting session data...`);
        const decryptedSessionString = await decrypt(tokenCookie.value);
        const sessionData: SessionData = JSON.parse(decryptedSessionString);
        console.log(`👤 [PROXY] Session role: ${sessionData.role}`);

        const baseUrl = getPublicBaseUrl(request);
        console.log(`🌐 [PROXY] Base URL: ${baseUrl}`);

        if (sessionData.role === 'provider') {
          const redirectUrl = new URL('/provider/dashboard', baseUrl);
          console.log(`🔀 [PROXY] Redirecting provider to: ${redirectUrl.toString()}`);
          return NextResponse.redirect(redirectUrl);
        } else if (sessionData.role === 'patient') {
          const redirectUrl = new URL('/patient/dashboard', baseUrl);
          console.log(`🔀 [PROXY] Redirecting patient to: ${redirectUrl.toString()}`);
          return NextResponse.redirect(redirectUrl);
        } else {
          console.warn(`⚠️ [PROXY] Unknown role: ${sessionData.role}, allowing access to homepage`);
        }
      } catch (error) {
        console.error('❌ [PROXY] Failed to decrypt session for index page:', error);
        // If decryption fails, clear cookie and let user see index page
        const response = NextResponse.next();
        response.cookies.delete(TOKEN_COOKIE_NAME);
        return response;
      }
    }

    // No valid session, show index page
    console.log(`✅ [PROXY] Anonymous user on index page, allowing access`);
    return NextResponse.next();
  }

  // Check for valid session on protected routes
  const tokenCookie = request.cookies.get(TOKEN_COOKIE_NAME);

  if (!tokenCookie) {
    console.log(`❌ [PROXY] Missing session cookie for: ${pathname}`);

    // For API routes, return 401 Unauthorized instead of redirect
    if (pathname.startsWith('/api/')) {
      console.log(`🔐 [PROXY] API route authentication required, returning 401: ${pathname}`);
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // For page routes, redirect to home
    console.log(`🏠 [PROXY] Page route redirecting to home: ${pathname}`);
    const baseUrl = getPublicBaseUrl(request);
    return NextResponse.redirect(new URL('/', baseUrl));
  }

  // Cookie is encrypted and HTTP-only - secure storage

  try {
    // Decrypt session cookie
    const decryptedSessionString = await decrypt(tokenCookie.value);
    const sessionData: SessionData = JSON.parse(decryptedSessionString);

    // Session validated - role and expiry checked below

    // Check if session is expired or expiring soon and attempt refresh if possible
    const refreshBufferSeconds = 300; // 5 minutes buffer before token expiry
    const refreshThreshold = Date.now() + (refreshBufferSeconds * 1000);
    const timeUntilExpiry = sessionData.expiresAt ? Math.round((sessionData.expiresAt - Date.now()) / 1000) : null;
    const isExpired = sessionData.expiresAt && sessionData.expiresAt < Date.now();

    if (sessionData.expiresAt && sessionData.expiresAt <= refreshThreshold) {
      console.log(`⏰ [PROXY] Token ${isExpired ? 'EXPIRED' : 'expiring soon'} (${timeUntilExpiry}s), attempting refresh: ${pathname}`);

      // If we have a refresh token, try to refresh the access token
      if (sessionData.refreshToken && sessionData.tokenUrl) {
        try {
          console.log('🔄 [PROXY] Attempting to refresh access token...');

          // Use library function for token refresh (clientId/clientSecret retrieved from env based on role)
          const newTokenData = await refreshAccessToken(
            sessionData.refreshToken,
            sessionData.tokenUrl,
            sessionData.role
          );

          console.log('✅ [PROXY] Token refresh successful');
          console.log('📊 [PROXY] New token data:', {
            expires_in: newTokenData.expires_in,
            expires_in_seconds: newTokenData.expires_in || 3600,
            new_expiresAt: new Date(Date.now() + (newTokenData.expires_in || 3600) * 1000).toISOString(),
            has_refresh_token: !!newTokenData.refresh_token
          });

          // Update session data with new tokens
          const refreshedSessionData: SessionData = {
            ...sessionData,
            accessToken: newTokenData.access_token,
            refreshToken: newTokenData.refresh_token || sessionData.refreshToken, // Use new refresh token if provided
            expiresAt: Date.now() + (newTokenData.expires_in || 3600) * 1000,
          };

          // Re-encrypt session data
          const encryptedRefreshedSessionData = await encrypt(JSON.stringify(refreshedSessionData));

          // Parse SESSION_EXPIRY environment variable (e.g., "7d", "30m", "2h")
          function parseSessionExpiry(expiry: string = '7d'): number {
            const match = expiry.match(/^(\d+)([smhdy])$/);
            if (!match) return 7 * 24 * 60 * 60; // Default to 7 days

            const [, value, unit] = match;
            const num = parseInt(value);

            switch (unit) {
              case 's': return num;
              case 'm': return num * 60;
              case 'h': return num * 60 * 60;
              case 'd': return num * 24 * 60 * 60;
              case 'y': return num * 365 * 24 * 60 * 60;
              default: return 7 * 24 * 60 * 60;
            }
          }

          // Continue with the request but update cookie
          const response = NextResponse.next();
          const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict' as const,
            maxAge: parseSessionExpiry(process.env.SESSION_EXPIRY), // Use SESSION_EXPIRY instead of access token expiry
            path: '/',
          };

          response.cookies.set(TOKEN_COOKIE_NAME, encryptedRefreshedSessionData, cookieOptions);

          console.log(`✅ [PROXY] Session refreshed for ${refreshedSessionData.role}, allowing: ${pathname}`);
          return response;
        } catch (refreshError) {
          console.error('❌ [PROXY] Token refresh error:', refreshError);

          // Check if it's a network error
          if (refreshError instanceof TokenRefreshError && refreshError.isNetworkError) {
            // Network error - preserve cookie and allow request to proceed
            // User can retry when network is back
            console.warn(`⚠️ [PROXY] Network error during token refresh (status: ${refreshError.statusCode}), preserving session cookie`);
            console.warn(`⚠️ [PROXY] Allowing request to proceed - user may see stale data or errors`);

            // Continue with the request without modifying cookies
            return NextResponse.next();
          }

          // Authentication error (invalid refresh token) - fall through to delete cookie
          console.error(`❌ [PROXY] Authentication error during token refresh (status: ${refreshError instanceof TokenRefreshError ? refreshError.statusCode : 'unknown'})`);
        }
      }

      // If refresh failed with auth error or no refresh token, redirect to home and delete cookie
      console.log(`❌ [PROXY] Session expired and refresh failed (invalid token), redirecting to home: ${pathname}`);
      const baseUrl = getPublicBaseUrl(request);
      const response = NextResponse.redirect(new URL('/', baseUrl));
      response.cookies.delete(TOKEN_COOKIE_NAME);
      return response;
    }

    // Validate role-based access
    const baseUrl = getPublicBaseUrl(request);
    console.log(`🔍 [PROXY] Validating role-based access for path: ${pathname}, role: ${sessionData.role}`);

    if (pathname.startsWith('/patient/') && sessionData.role !== 'patient') {
      const redirectPath = sessionData.role === 'provider' ? '/provider/dashboard' : '/';
      const redirectUrl = new URL(redirectPath, baseUrl);
      console.log(`❌ [PROXY] Patient route denied for ${sessionData.role}, redirecting to: ${redirectUrl.toString()}`);
      return NextResponse.redirect(redirectUrl);
    }

    if (pathname.startsWith('/provider/') && sessionData.role !== 'provider') {
      const redirectPath = sessionData.role === 'patient' ? '/patient/dashboard' : '/';
      const redirectUrl = new URL(redirectPath, baseUrl);
      console.log(`❌ [PROXY] Provider route denied for ${sessionData.role}, redirecting to: ${redirectUrl.toString()}`);
      return NextResponse.redirect(redirectUrl);
    }

    // Session validated - cookies remain encrypted and HTTP-only for security
    const response = NextResponse.next();

    console.log(`✅ [PROXY] Valid session for ${sessionData.role}, allowing: ${pathname}`);
    return response;

  } catch (error) {
    console.error('❌ [PROXY] Session decryption failed:', error);
    const baseUrl = getPublicBaseUrl(request);
    const response = NextResponse.redirect(new URL('/', baseUrl));
    response.cookies.delete(TOKEN_COOKIE_NAME);
    return response;
  }
}

export const config = {
  matcher: [
    '/',
    '/patient/:path*',
    '/provider/:path*',
    '/api/fhir/:path*'
  ],
};
