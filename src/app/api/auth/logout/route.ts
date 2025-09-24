import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { decrypt } from '@/library/auth/encryption';
import { AuthSession, TokenData, SessionData } from '@/types/auth';
import { SESSION_COOKIE_NAME, TOKEN_COOKIE_NAME } from '@/library/auth/config';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get(TOKEN_COOKIE_NAME);
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
    
    let sessionData: AuthSession | null = null;
    
    // Try to get session data for token revocation - need both cookies
    if (tokenCookie && sessionCookie) {
      try {
        const decryptedTokenString = await decrypt(tokenCookie.value);
        const decryptedSessionString = await decrypt(sessionCookie.value);
        
        const tokenData: TokenData = JSON.parse(decryptedTokenString);
        const sessionMetadata: SessionData = JSON.parse(decryptedSessionString);
        
        // Combine for backward compatibility
        // sessionData is extracted but not used for logout logic
        sessionData = {
          ...tokenData,
          ...sessionMetadata
        };
      } catch {
        console.warn('Failed to decrypt session cookies for logout, proceeding with cookie deletion only');
      }
    }
    
    // Token revocation is now handled client-side with session URLs
    
    // Always clear both cookies
    const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
    
    const cookieClearOptions = {
      path: '/',
      maxAge: 0,
      sameSite: 'strict' as const,
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true
    };
    
    response.cookies.set(TOKEN_COOKIE_NAME, '', cookieClearOptions);
    response.cookies.set(SESSION_COOKIE_NAME, '', cookieClearOptions);
    
    return response;
    
  } catch (error) {
    console.error('Logout error:', error);
    
    // Even if logout fails, clear both cookies
    const response = NextResponse.json(
      { success: false, error: 'Logout failed but cookies cleared' },
      { status: 500 }
    );
    
    const cookieClearOptions = {
      path: '/',
      maxAge: 0,
      sameSite: 'strict' as const,
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true
    };
    
    response.cookies.set(TOKEN_COOKIE_NAME, '', cookieClearOptions);
    response.cookies.set(SESSION_COOKIE_NAME, '', cookieClearOptions);
    
    return response;
  }
}