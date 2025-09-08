import { NextRequest, NextResponse } from 'next/server';
import { AuthSession } from '@/types/auth';
import { decrypt, encrypt } from '@/library/auth/encryption';

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

  // Check for valid session on protected routes
  const sessionCookie = request.cookies.get('healermy_session');
  
  if (!sessionCookie) {
    console.log(`❌ [MIDDLEWARE] No session cookie, redirecting to home: ${pathname}`);
    return NextResponse.redirect(new URL('/', request.url));
  }

  // DEBUG: Log encrypted cookie (DELETE BEFORE PRODUCTION)
  console.log(`🍪 [DEBUG] Encrypted session cookie:`, sessionCookie.value.substring(0, 50) + '...');

  try {
    // Decrypt entire session object
    const decryptedSessionString = await decrypt(sessionCookie.value);
    const sessionData: AuthSession = JSON.parse(decryptedSessionString);
    
    // DEBUG: Log decrypted session structure (DELETE BEFORE PRODUCTION)
    console.log(`🔓 [DEBUG] Decrypted session data:`, {
      role: sessionData.role,
      accessToken: sessionData.accessToken ? `${sessionData.accessToken.substring(0, 20)}...` : 'undefined',
      fhirBaseUrl: sessionData.fhirBaseUrl,
      patient: sessionData.patient,
      expiresAt: sessionData.expiresAt
    });
    
    // Check if session is expired or expiring soon (within 5 minutes) and attempt refresh if possible
    const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000);
    if (sessionData.expiresAt && sessionData.expiresAt <= fiveMinutesFromNow) {
      console.log(`⏰ [MIDDLEWARE] Session expired, attempting token refresh: ${pathname}`);
      
      // If we have a refresh token, try to refresh the access token
      if (sessionData.refreshToken && sessionData.tokenUrl && sessionData.clientId && sessionData.clientSecret) {
        try {
          console.log('🔄 [MIDDLEWARE] Attempting to refresh access token...');
          
          // Prepare refresh token request
          const tokenParams = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: sessionData.refreshToken,
          });

          // Use Basic Authentication (Edge Runtime compatible)
          const credentials = btoa(`${sessionData.clientId}:${sessionData.clientSecret}`);
          
          const tokenResponse = await fetch(sessionData.tokenUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': `Basic ${credentials}`,
              'Accept': 'application/json',
            },
            body: tokenParams.toString(),
          });

          if (tokenResponse.ok) {
            const tokenData = await tokenResponse.json();
            console.log('✅ [MIDDLEWARE] Token refresh successful');
            
            // Update session with new tokens
            const refreshedSession = {
              ...sessionData,
              accessToken: tokenData.access_token,
              refreshToken: tokenData.refresh_token || sessionData.refreshToken, // Use new refresh token if provided
              expiresAt: Date.now() + (tokenData.expires_in || 3600) * 1000,
            };
            
            // Re-encrypt the refreshed session
            const encryptedRefreshedSession = await encrypt(JSON.stringify(refreshedSession));
            
            // Continue with the request but update the cookie
            const response = NextResponse.next();
            response.cookies.set('healermy_session', encryptedRefreshedSession, {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'strict',
              maxAge: Math.floor((refreshedSession.expiresAt - Date.now()) / 1000),
              path: '/',
            });
            response.headers.set('x-session-data', JSON.stringify(refreshedSession));
            
            console.log(`✅ [MIDDLEWARE] Session refreshed for ${refreshedSession.role}, allowing: ${pathname}`);
            return response;
            
          } else {
            console.log('❌ [MIDDLEWARE] Token refresh failed, redirecting to home');
          }
        } catch (refreshError) {
          console.error('❌ [MIDDLEWARE] Token refresh error:', refreshError);
        }
      }
      
      // If refresh failed or no refresh token, redirect to home
      console.log(`❌ [MIDDLEWARE] Session expired and refresh failed, redirecting to home: ${pathname}`);
      const response = NextResponse.redirect(new URL('/', request.url));
      response.cookies.delete('healermy_session');
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
    response.cookies.delete('healermy_session');
    return response;
  }
}

export const config = {
  matcher: [
    '/patient/:path*',
    '/provider/:path*',
    '/test/:path*'
  ],
};