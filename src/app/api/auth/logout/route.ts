import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { decrypt } from '@/lib/auth/encryption';
import { TOKEN_COOKIE_NAME } from '@/lib/auth/config';
import type { SessionData } from '@/types/auth';

export async function POST() {
  try {
    // Get session to access refresh token and revoke URL
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get(TOKEN_COOKIE_NAME);

    if (tokenCookie) {
      try {
        const decryptedSessionString = await decrypt(tokenCookie.value);
        const session: SessionData = JSON.parse(decryptedSessionString);

        // Attempt token revocation if we have required data
        if (session.refreshToken && session.revokeUrl) {
          // Get client credentials from environment
          const clientId = process.env.CLIENT_ID;
          const clientSecret = process.env.CLIENT_SECRET;

          if (clientId && clientSecret) {
            const revokeParams = new URLSearchParams({
              token: session.refreshToken,
              token_type_hint: 'refresh_token'
            });

            const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

            const revokeResponse = await fetch(session.revokeUrl, {
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
            } else {

            }
          } else {
            console.warn('⚠️  Client credentials not found in environment - skipping token revocation');
          }
        }
      } catch (sessionError) {
        console.warn('⚠️  Could not read session for token revocation:', sessionError);
        // Continue with cookie clearing anyway
      }
    }

    // Always clear session cookie
    const response = NextResponse.json({ success: true, message: 'Logged out successfully' });

    const cookieClearOptions = {
      path: '/',
      maxAge: 0,
      sameSite: 'strict' as const,
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true
    };

    response.cookies.set(TOKEN_COOKIE_NAME, '', cookieClearOptions);

    return response;

  } catch (error) {
    console.error('Logout error:', error);

    // Even if logout fails, clear cookie
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

    return response;
  }
}