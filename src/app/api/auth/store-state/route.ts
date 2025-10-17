import { NextRequest, NextResponse } from 'next/server';
import { encrypt } from '@/library/auth/encryption';

// Temporary OAuth state storage (5 minutes expiry)
const STATE_COOKIE_PREFIX = 'oauth_state_';
const STATE_EXPIRY_SECONDS = 300; // 5 minutes

interface OAuthStateData {
  iss: string;
  role: 'patient' | 'provider' | 'practitioner';
  codeVerifier?: string;
  tokenUrl?: string;
  revokeUrl?: string;
  launchToken?: string;
  timestamp: number;
}

/**
 * POST /api/auth/store-state
 *
 * Stores OAuth state data server-side in encrypted HTTP-only cookie.
 * This prevents sensitive data (clientSecret, codeVerifier) from being
 * stored in browser sessionStorage (security vulnerability).
 *
 * Request body:
 * {
 *   state: string,        // OAuth state parameter
 *   data: OAuthStateData  // Data to store
 * }
 *
 * Security:
 * - Data encrypted with AES-GCM
 * - HTTP-only cookie (not accessible to JavaScript)
 * - Secure flag in production
 * - 5-minute expiry (short-lived)
 * - SameSite=Lax (CSRF protection)
 */
export async function POST(request: NextRequest) {
  try {
    const { state, data } = await request.json() as { state: string; data: OAuthStateData };

    if (!state || typeof state !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid state parameter' },
        { status: 400 }
      );
    }

    if (!data || !data.iss || !data.role) {
      return NextResponse.json(
        { error: 'Missing required OAuth state data' },
        { status: 400 }
      );
    }

    // Add timestamp for expiry tracking
    const stateData: OAuthStateData = {
      ...data,
      timestamp: Date.now()
    };

    // Encrypt the OAuth state data
    const encryptedState = await encrypt(JSON.stringify(stateData));

    // Store in HTTP-only, secure cookie
    const response = NextResponse.json({ success: true });
    response.cookies.set(`${STATE_COOKIE_PREFIX}${state}`, encryptedState, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: STATE_EXPIRY_SECONDS,
      path: '/'
    });

    console.log('OAuth state stored successfully for state:', state.substring(0, 8) + '...');

    return response;
  } catch (error) {
    console.error('Error storing OAuth state:', error);
    return NextResponse.json(
      { error: 'Failed to store OAuth state' },
      { status: 500 }
    );
  }
}
