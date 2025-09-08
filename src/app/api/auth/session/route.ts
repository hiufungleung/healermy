import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { AuthSession } from '@/types/auth';
import { decrypt } from '@/library/auth/encryption';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    
    // Check for our custom session cookie
    const sessionCookie = cookieStore.get('healermy_session');
    
    if (!sessionCookie) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    
    try {
      // Decrypt entire session object (new full encryption approach)
      const decryptedSessionString = await decrypt(sessionCookie.value);
      const sessionData: AuthSession = JSON.parse(decryptedSessionString);
      
      // Check if session is expired
      if (sessionData.expiresAt && sessionData.expiresAt <= Date.now()) {
        return NextResponse.json({ authenticated: false, expired: true }, { status: 401 });
      }
      
      // Return safe session data (no sensitive tokens sent to client)
      const safeSessionData = {
        role: sessionData.role,
        fhirBaseUrl: sessionData.fhirBaseUrl,
        patient: sessionData.patient,
        fhirUser: sessionData.fhirUser,
        expiresAt: sessionData.expiresAt,
        clientId: sessionData.clientId,
        tokenUrl: sessionData.tokenUrl,
        // Note: accessToken, refreshToken, clientSecret are NOT sent to client
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
  response.cookies.set('healermy_session', '', {
    path: '/',
    maxAge: 0,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true
  });

  return response;
}