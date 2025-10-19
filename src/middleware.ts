import { NextRequest, NextResponse } from 'next/server';
import { AuthSession, TokenData, SessionData } from '@/types/auth';
import { decrypt, encrypt } from '@/library/auth/encryption';
import { refreshAccessToken } from '@/library/auth/tokenRefresh';
import { SESSION_COOKIE_NAME, TOKEN_COOKIE_NAME } from '@/library/auth/config';
import { getPublicBaseUrl } from '@/library/server-utils';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  console.log(`🚀 [MIDDLEWARE START] ${new Date().toISOString()} - ${pathname}`);
  
  // Skip middleware for public routes and API routes that don't need auth
  const isPublicRoute = [
      '/launch',
      '/auth/callback',
      '/api/auth',
      '/_next',
      '/favicon.ico',
    ].some(path => request.nextUrl.pathname.startsWith(path));

  if (isPublicRoute) {
    console.log(`✅ [MIDDLEWARE] Public route, skipping: ${pathname}`);
    return NextResponse.next();
  }

  // Special handling for index page "/" - check if user is already authenticated
  if (pathname === '/') {
    const tokenCookie = request.cookies.get(TOKEN_COOKIE_NAME);
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
    
    // If user has valid session cookies, redirect to appropriate dashboard
    if (tokenCookie && sessionCookie) {
      try {
        const decryptedSessionString = await decrypt(sessionCookie.value);
        const sessionMetadata: SessionData = JSON.parse(decryptedSessionString);
        
        const baseUrl = getPublicBaseUrl(request);
        if (sessionMetadata.role === 'provider') {
          console.log(`🔀 [MIDDLEWARE] Authenticated provider accessing /, redirecting to provider dashboard`);
          return NextResponse.redirect(new URL('/provider/dashboard', baseUrl));
        } else if (sessionMetadata.role === 'patient') {
          console.log(`🔀 [MIDDLEWARE] Authenticated patient accessing /, redirecting to patient dashboard`);
          return NextResponse.redirect(new URL('/patient/dashboard', baseUrl));
        }
      } catch (error) {
        console.error('❌ [MIDDLEWARE] Failed to decrypt session for index page:', error);
        // If decryption fails, clear cookies and let user see index page
        const response = NextResponse.next();
        response.cookies.delete(TOKEN_COOKIE_NAME);
        response.cookies.delete(SESSION_COOKIE_NAME);
        return response;
      }
    }
    
    // No valid session, show index page
    console.log(`✅ [MIDDLEWARE] Anonymous user on index page, allowing access`);
    return NextResponse.next();
  }

  // Check for valid session on protected routes - need both cookies
  const tokenCookie = request.cookies.get(TOKEN_COOKIE_NAME);
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);

  if (!tokenCookie || !sessionCookie) {
    console.log(`❌ [MIDDLEWARE] Missing required cookies (token: ${!!tokenCookie}, session: ${!!sessionCookie}) for: ${pathname}`);
    
    // For API routes, return 401 Unauthorized instead of redirect
    if (pathname.startsWith('/api/')) {
      console.log(`🔐 [MIDDLEWARE] API route authentication required, returning 401: ${pathname}`);
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    // For page routes, redirect to home
    console.log(`🏠 [MIDDLEWARE] Page route redirecting to home: ${pathname}`);
    const baseUrl = getPublicBaseUrl(request);
    return NextResponse.redirect(new URL('/', baseUrl));
  }

  // Cookies are encrypted and HTTP-only - secure storage

  try {
    // Decrypt both cookie parts
    const decryptedTokenString = await decrypt(tokenCookie.value);
    const decryptedSessionString = await decrypt(sessionCookie.value);
    
    const tokenData: TokenData = JSON.parse(decryptedTokenString);
    const sessionMetadata: SessionData = JSON.parse(decryptedSessionString);
    
    // Combine into a single session object for backward compatibility
    const sessionData: AuthSession = {
      ...tokenData,
      ...sessionMetadata
    };
    
    // Session validated - role and expiry checked below
    
    // Check if session is expired or expiring soon and attempt refresh if possible
    const refreshBufferSeconds = 300; // 5 minutes buffer before token expiry
    const refreshThreshold = Date.now() + (refreshBufferSeconds * 1000);
    if (sessionData.expiresAt && sessionData.expiresAt <= refreshThreshold) {
      console.log(`⏰ [MIDDLEWARE] Session expires in ${Math.round((sessionData.expiresAt - Date.now()) / 1000)}s (buffer: ${refreshBufferSeconds}s), attempting token refresh: ${pathname}`);
      
      // If we have a refresh token, try to refresh the access token
      if (sessionData.refreshToken && sessionData.tokenUrl && sessionData.clientId && sessionData.clientSecret) {
        try {
          console.log('🔄 [MIDDLEWARE] Attempting to refresh access token...');
          
          // Use library function for token refresh with tokenUrl from session cookie
          const newTokenData = await refreshAccessToken(
            sessionData.refreshToken,
            sessionData.tokenUrl,
            sessionData.clientId,
            sessionData.clientSecret
          );
          
          console.log('✅ [MIDDLEWARE] Token refresh successful');
          
          // Update token data with new tokens
          const refreshedTokenData: TokenData = {
            ...tokenData,
            accessToken: newTokenData.access_token,
            refreshToken: newTokenData.refresh_token || sessionData.refreshToken, // Use new refresh token if provided
            expiresAt: Date.now() + (newTokenData.expires_in || 3600) * 1000,
          };
          
          // Session metadata remains the same
          const refreshedSessionData: SessionData = sessionMetadata;
          
          // Re-encrypt both parts
          const encryptedRefreshedTokenData = await encrypt(JSON.stringify(refreshedTokenData));
          const encryptedRefreshedSessionData = await encrypt(JSON.stringify(refreshedSessionData));
          
          // Combine for backward compatibility in response headers
          const refreshedSession: AuthSession = {
            ...refreshedTokenData,
            ...refreshedSessionData
          };
          
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
          
          // Continue with the request but update both cookies
          const response = NextResponse.next();
          const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict' as const,
            maxAge: parseSessionExpiry(process.env.SESSION_EXPIRY), // Use SESSION_EXPIRY instead of access token expiry
            path: '/',
          };
          
          response.cookies.set(TOKEN_COOKIE_NAME, encryptedRefreshedTokenData, cookieOptions);
          response.cookies.set(SESSION_COOKIE_NAME, encryptedRefreshedSessionData, cookieOptions);

          console.log(`✅ [MIDDLEWARE] Session refreshed for ${refreshedSession.role}, allowing: ${pathname}`);
          return response;
        } catch (refreshError) {
          console.error('❌ [MIDDLEWARE] Token refresh error:', refreshError);
        }
      }
      
      // If refresh failed or no refresh token, redirect to home
      console.log(`❌ [MIDDLEWARE] Session expired and refresh failed, redirecting to home: ${pathname}`);
      const baseUrl = getPublicBaseUrl(request);
      const response = NextResponse.redirect(new URL('/', baseUrl));
      response.cookies.delete(TOKEN_COOKIE_NAME);
      response.cookies.delete(SESSION_COOKIE_NAME);
      return response;
    }

    // Validate role-based access
    const baseUrl = getPublicBaseUrl(request);
    if (pathname.startsWith('/patient/') && sessionData.role !== 'patient') {
      console.log(`❌ [MIDDLEWARE] Patient route access denied for role: ${sessionData.role}`);
      return NextResponse.redirect(new URL('/', baseUrl));
    }

    if (pathname.startsWith('/provider/') && sessionData.role !== 'provider') {
      console.log(`❌ [MIDDLEWARE] Provider route access denied for role: ${sessionData.role}`);
      return NextResponse.redirect(new URL('/', baseUrl));
    }

    if (pathname.startsWith('/practitioner/') && sessionData.role !== 'practitioner') {
      console.log(`❌ [MIDDLEWARE] Practitioner route access denied for role: ${sessionData.role}`);
      return NextResponse.redirect(new URL('/', baseUrl));
    }

    // Session validated - cookies remain encrypted and HTTP-only for security
    const response = NextResponse.next();

    console.log(`✅ [MIDDLEWARE] Valid session for ${sessionData.role}, allowing: ${pathname}`);
    return response;
    
  } catch (error) {
    console.error('❌ [MIDDLEWARE] Session decryption failed:', error);
    const baseUrl = getPublicBaseUrl(request);
    const response = NextResponse.redirect(new URL('/', baseUrl));
    response.cookies.delete(TOKEN_COOKIE_NAME);
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }
}

export const config = {
  matcher: [
    '/',
    '/patient/:path*',
    '/provider/:path*',
    '/practitioner/:path*',
    '/api/fhir/:path*'
  ],
};