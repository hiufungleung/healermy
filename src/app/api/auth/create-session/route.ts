import { NextRequest, NextResponse } from 'next/server';
import { AuthSession, TokenData, SessionData } from '@/types/auth';
import { encrypt } from '@/library/auth/encryption';
import { SESSION_COOKIE_NAME, TOKEN_COOKIE_NAME } from '@/library/auth/config';

export async function POST(request: NextRequest) {
  try {
    const fullSessionData: AuthSession = await request.json();
    
    console.log('📝 Creating session for role:', fullSessionData.role);
    
    // Split session data into tokens and metadata
    const tokenData: TokenData = {
      accessToken: fullSessionData.accessToken,
      refreshToken: fullSessionData.refreshToken,
      clientId: fullSessionData.clientId,
      clientSecret: fullSessionData.clientSecret,
      expiresAt: fullSessionData.expiresAt,
    };
    
    const sessionData: SessionData = {
      role: fullSessionData.role,
      patient: fullSessionData.patient,
      user: fullSessionData.user,
      username: fullSessionData.username,
      encounter: fullSessionData.encounter,
      needPatientBanner: fullSessionData.needPatientBanner,
      need_patient_banner: fullSessionData.need_patient_banner,
      fhirUser: fullSessionData.fhirUser,
      tokenUrl: fullSessionData.tokenUrl || '',
      revokeUrl: fullSessionData.revokeUrl,
      fhirBaseUrl: fullSessionData.fhirBaseUrl || '',
      scope: fullSessionData.scope,
      tenant: fullSessionData.tenant,
    };
    
    // Encrypt both parts separately
    const encryptedTokenData = await encrypt(JSON.stringify(tokenData));
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
    const cookieMaxAge = tokenData.refreshToken 
      ? parseSessionExpiry(process.env.SESSION_EXPIRY)  // Use env variable for offline access
      : tokenData.expiresAt 
        ? Math.floor((tokenData.expiresAt - Date.now()) / 1000)
        : parseSessionExpiry(process.env.SESSION_EXPIRY); // Use env variable as fallback
    
    // Log detailed size breakdown before encryption
    const tokenDataString = JSON.stringify(tokenData);
    const sessionDataString = JSON.stringify(sessionData);
    
    console.log('📊 Cookie size breakdown BEFORE encryption:');
    console.log('🔑 Token cookie:');
    console.log('- JSON length:', tokenDataString.length);
    Object.entries(tokenData).forEach(([key, value]) => {
      const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
      if (valueStr && valueStr.length > 100) {
        console.log(`  - ${key}:`, valueStr.length, 'chars', valueStr.substring(0, 50) + '...');
      } else {
        console.log(`  - ${key}:`, valueStr ? valueStr.length : 0, 'chars');
      }
    });
    
    console.log('📋 Session cookie:');
    console.log('- JSON length:', sessionDataString.length);
    Object.entries(sessionData).forEach(([key, value]) => {
      const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
      if (valueStr && valueStr.length > 50) {
        console.log(`  - ${key}:`, valueStr.length, 'chars', valueStr.substring(0, 50) + '...');
      } else {
        console.log(`  - ${key}:`, valueStr ? valueStr.length : 0, 'chars');
      }
    });

    console.log('🍪 Setting cookies:', {
      tokenCookie: {
        name: TOKEN_COOKIE_NAME,
        unencryptedLength: tokenDataString.length,
        encryptedLength: encryptedTokenData.length
      },
      sessionCookie: {
        name: SESSION_COOKIE_NAME,
        unencryptedLength: sessionDataString.length,
        encryptedLength: encryptedSessionData.length
      },
      maxAge: cookieMaxAge,
    });

    // Set both cookies with same security settings
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      maxAge: cookieMaxAge,
      path: '/',
    };
    
    response.cookies.set(TOKEN_COOKIE_NAME, encryptedTokenData, cookieOptions);
    response.cookies.set(SESSION_COOKIE_NAME, encryptedSessionData, cookieOptions);

    console.log('✅ Session created successfully with encrypted sensitive data');
    return response;

  } catch (error) {
    console.error('❌ Session creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}