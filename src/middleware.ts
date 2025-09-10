import { NextRequest, NextResponse } from 'next/server';
import { AuthSession, TokenData, SessionData } from '@/types/auth';
import { decrypt, encrypt } from '@/library/auth/encryption';
import { refreshAccessToken } from '@/library/auth/tokenRefresh';
import { SESSION_COOKIE_NAME, TOKEN_COOKIE_NAME } from '@/library/auth/config';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  console.log(`🚀 [MIDDLEWARE START] ${new Date().toISOString()} - ${pathname}`);
  
  // Skip middleware for public routes and API routes that don't need auth
  const isPublicRoute = [
      '/launch',
      '/auth/callback',
      '/api/auth',
      '/api/debug-log',
      '/_next',
      '/favicon.ico',
    ].some(path => request.nextUrl.pathname.startsWith(path)) ||
    request.nextUrl.pathname === '/'; 

  if (isPublicRoute) {
    console.log(`✅ [MIDDLEWARE] Public route, skipping: ${pathname}`);
    return NextResponse.next();
  }

  // Check for valid session on protected routes - need both cookies
  const tokenCookie = request.cookies.get(TOKEN_COOKIE_NAME);
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);

  if (!tokenCookie || !sessionCookie) {
    console.log(`❌ [MIDDLEWARE] Missing required cookies (token: ${!!tokenCookie}, session: ${!!sessionCookie}), redirecting to home: ${pathname}`);
    return NextResponse.redirect(new URL('/', request.url));
  }

  // DEBUG: Log encrypted cookies (DELETE BEFORE PRODUCTION)
  console.log(`🍪 [DEBUG] Encrypted token cookie:`, tokenCookie.value.substring(0, 50) + '...');
  console.log(`🍪 [DEBUG] Encrypted session cookie:`, sessionCookie.value.substring(0, 50) + '...');

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
    
    // DEBUG: Log decrypted session structure (DELETE BEFORE PRODUCTION)
    console.log(`🔓 [DEBUG] Decrypted session data:`, {
      role: sessionData.role,
      accessToken: sessionData.accessToken ? `${sessionData.accessToken.substring(0, 20)}...` : 'undefined',
      patient: sessionData.patient,
      user: sessionData.user, // Show user field for provider detection
      username: sessionData.username, // Show username field
      need_patient_banner: sessionData.need_patient_banner,
      expiresAt: sessionData.expiresAt
    });

    console.log(`Access Token: ${sessionData.accessToken}`);
    
    // Check if session is expired or expiring soon (within 5 minutes) and attempt refresh if possible
    const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000);
    if (sessionData.expiresAt && sessionData.expiresAt <= fiveMinutesFromNow) {
      console.log(`⏰ [MIDDLEWARE] Session expired, attempting token refresh: ${pathname}`);
      
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
          response.headers.set('x-session-data', JSON.stringify(refreshedSession));
          
          console.log(`✅ [MIDDLEWARE] Session refreshed for ${refreshedSession.role}, allowing: ${pathname}`);
          return response;
        } catch (refreshError) {
          console.error('❌ [MIDDLEWARE] Token refresh error:', refreshError);
        }
      }
      
      // If refresh failed or no refresh token, redirect to home
      console.log(`❌ [MIDDLEWARE] Session expired and refresh failed, redirecting to home: ${pathname}`);
      const response = NextResponse.redirect(new URL('/', request.url));
      response.cookies.delete(TOKEN_COOKIE_NAME);
      response.cookies.delete(SESSION_COOKIE_NAME);
      return response;
    }

    // Validate role-based access
    if (pathname.startsWith('/patient/') && sessionData.role !== 'patient') {
      console.log(`❌ [MIDDLEWARE] Patient route access denied for role: ${sessionData.role}`);
      return NextResponse.redirect(new URL('/', request.url));
    }

    if (pathname.startsWith('/provider/') && sessionData.role !== 'provider') {
      console.log(`❌ [MIDDLEWARE] Provider route access denied for role: ${sessionData.role}`);
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Session data is already fully decrypted, ready to pass to route
    const sessionForRoute = sessionData;

    // Pass decrypted session data to the route via headers
    const response = NextResponse.next();
    response.headers.set('x-session-data', JSON.stringify(sessionForRoute));

    console.log(`✅ [MIDDLEWARE] Valid session for ${sessionData.role}, fully decrypted, allowing: ${pathname}`);
    return response;
    
  } catch (error) {
    console.error('❌ [MIDDLEWARE] Session decryption failed:', error);
    const response = NextResponse.redirect(new URL('/', request.url));
    response.cookies.delete(TOKEN_COOKIE_NAME);
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }
}

export const config = {
  matcher: [
    '/patient/:path*',
    '/provider/:path*',
    '/test/:path*',
    '/api/fhir/:path*'
  ],
};