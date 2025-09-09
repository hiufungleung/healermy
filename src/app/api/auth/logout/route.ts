import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { decrypt } from '@/library/auth/encryption';
import { AuthSession } from '@/types/auth';
import { SESSION_COOKIE_NAME } from '@/library/auth/config';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
    
    let sessionData: AuthSession | null = null;
    
    // Try to get session data for token revocation
    if (sessionCookie) {
      try {
        const decryptedSessionString = await decrypt(sessionCookie.value);
        sessionData = JSON.parse(decryptedSessionString);
      } catch (error) {
        console.warn('Failed to decrypt session for logout, proceeding with cookie deletion only');
      }
    }
    
    // Revoke refresh token if we have the necessary info
    if (sessionData?.revokeUrl && sessionData?.refreshToken && sessionData?.clientId && sessionData?.clientSecret) {
      try {
        // Only revoke refresh token (Cerner doesn't support access token revocation)
        const revokeParams = new URLSearchParams({
          token: sessionData.refreshToken,
          token_type_hint: 'refresh_token'
        });
        
        // Use Basic Authentication
        const credentials = btoa(`${sessionData.clientId}:${sessionData.clientSecret}`);
        
        const revokeResponse = await fetch(sessionData.revokeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${credentials}`,
            'Accept': 'application/json',
          },
          body: revokeParams.toString(),
        });
        
        if (!revokeResponse.ok) {
          console.warn(`Token revocation failed: ${revokeResponse.status}`);
        }
        
      } catch (revokeError) {
        console.error('Token revocation error:', revokeError);
        // Continue with logout even if revocation fails
      }
    }
    
    // Always clear the session cookie
    const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
    
    response.cookies.set(SESSION_COOKIE_NAME, '', {
      path: '/',
      maxAge: 0,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true
    });
    
    return response;
    
  } catch (error) {
    console.error('Logout error:', error);
    
    // Even if logout fails, clear the cookie
    const response = NextResponse.json(
      { success: false, error: 'Logout failed but cookie cleared' },
      { status: 500 }
    );
    
    response.cookies.set(SESSION_COOKIE_NAME, '', {
      path: '/',
      maxAge: 0,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true
    });
    
    return response;
  }
}