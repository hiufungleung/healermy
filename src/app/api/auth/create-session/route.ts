import { NextRequest, NextResponse } from 'next/server';
import { SessionData } from '@/types/auth';
import { encrypt } from '@/library/auth/encryption';
import { TOKEN_COOKIE_NAME } from '@/library/auth/config';

export async function POST(request: NextRequest) {
  try {
    const fullSessionData: any = await request.json();

    // Create simplified session data with only required fields
    const sessionData: SessionData = {
      accessToken: fullSessionData.accessToken,
      refreshToken: fullSessionData.refreshToken,
      expiresAt: fullSessionData.expiresAt,
      role: fullSessionData.role,
      patient: fullSessionData.patient,
      practitioner: fullSessionData.practitioner,
      tokenUrl: fullSessionData.tokenUrl || '',
      revokeUrl: fullSessionData.revokeUrl || '',
      fhirBaseUrl: fullSessionData.fhirBaseUrl || fullSessionData.iss || '',
    };

    // Encrypt session data
    const encryptedSessionData = await encrypt(JSON.stringify(sessionData));

    // Create secure HTTP-only cookie with fully encrypted data
    const response = NextResponse.json({ success: true });

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

    // For offline access, use SESSION_EXPIRY instead of access token expiry
    const cookieMaxAge = sessionData.refreshToken
      ? parseSessionExpiry(process.env.SESSION_EXPIRY)  // Use env variable for offline access
      : sessionData.expiresAt
        ? Math.floor((sessionData.expiresAt - Date.now()) / 1000)
        : parseSessionExpiry(process.env.SESSION_EXPIRY); // Use env variable as fallback

    // Log session data size
    const sessionDataString = JSON.stringify(sessionData);

    Object.entries(sessionData).forEach(([key, value]) => {
      const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
      if (valueStr && valueStr.length > 100) {
        
      } else {

      }
    });

    // Set single cookie with all session data
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      maxAge: cookieMaxAge,
      path: '/',
    };

    response.cookies.set(TOKEN_COOKIE_NAME, encryptedSessionData, cookieOptions);

    return response;

  } catch (error) {
    console.error('❌ Session creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}