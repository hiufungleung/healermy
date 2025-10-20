import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SessionData } from '@/types/auth';
import { decrypt } from '@/library/auth/encryption';
import { TOKEN_COOKIE_NAME } from '@/library/auth/config';

export async function GET() {
  try {
    const cookieStore = await cookies();

    // Check for our custom session cookie
    const sessionCookie = cookieStore.get(TOKEN_COOKIE_NAME);

    if (!sessionCookie) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    try {
      // Decrypt session data
      const decryptedSessionString = await decrypt(sessionCookie.value);
      const sessionData: SessionData = JSON.parse(decryptedSessionString);

      // Check if session is expired
      if (sessionData.expiresAt && sessionData.expiresAt <= Date.now()) {
        return NextResponse.json({ authenticated: false, expired: true }, { status: 401 });
      }

      // Return safe session data (no sensitive tokens sent to client)
      const safeSessionData = {
        role: sessionData.role,
        fhirBaseUrl: sessionData.fhirBaseUrl,
        patient: sessionData.patient,
        practitioner: sessionData.practitioner,
        expiresAt: sessionData.expiresAt,
        tokenUrl: sessionData.tokenUrl,
        // Note: accessToken, refreshToken are NOT sent to client
      };

      return NextResponse.json({
        authenticated: true,
        session: safeSessionData
      });
      
    } catch (parseError) {
      console.error('Failed to parse session cookie:', parseError);
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

  } catch (error) {
    console.error('Session API error:', error);
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });

  // Clear our session cookie
  response.cookies.set(TOKEN_COOKIE_NAME, '', {
    path: '/',
    maxAge: 0,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true
  });

  return response;
}