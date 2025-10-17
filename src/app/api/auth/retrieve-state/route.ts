import { NextRequest, NextResponse } from 'next/server';
import { decrypt } from '@/library/auth/encryption';

const STATE_COOKIE_PREFIX = 'oauth_state_';
const STATE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

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
 * GET /api/auth/retrieve-state?state=xxx
 *
 * Retrieves OAuth state data from server-side encrypted cookie.
 * This is called during OAuth callback to get the codeVerifier for PKCE.
 *
 * Query parameters:
 * - state: OAuth state parameter
 *
 * Response:
 * {
 *   iss: string,
 *   role: string,
 *   codeVerifier?: string
 * }
 *
 * Security:
 * - One-time use: Cookie deleted after retrieval
 * - Time-based expiry: Rejects states older than 5 minutes
 * - Encrypted data: AES-GCM decryption
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const state = searchParams.get('state');

    if (!state || typeof state !== 'string') {
      console.error('Missing or invalid state parameter in retrieve-state');
      return NextResponse.json(
        { error: 'Missing or invalid state parameter' },
        { status: 400 }
      );
    }

    // Retrieve encrypted state from cookie
    const cookieName = `${STATE_COOKIE_PREFIX}${state}`;
    const encryptedState = request.cookies.get(cookieName)?.value;

    if (!encryptedState) {
      console.error('OAuth state cookie not found:', cookieName);
      return NextResponse.json(
        { error: 'Invalid or expired OAuth state' },
        { status: 400 }
      );
    }

    // Decrypt state data
    const decryptedString = await decrypt(encryptedState);
    const stateData = JSON.parse(decryptedString) as OAuthStateData;

    if (!stateData || !stateData.iss || !stateData.role) {
      console.error('Invalid OAuth state data structure');
      return NextResponse.json(
        { error: 'Invalid OAuth state data' },
        { status: 400 }
      );
    }

    // Verify state hasn't expired (additional check beyond cookie maxAge)
    const age = Date.now() - stateData.timestamp;
    if (age > STATE_MAX_AGE_MS) {
      console.error('OAuth state expired:', { age, maxAge: STATE_MAX_AGE_MS });
      return NextResponse.json(
        { error: 'OAuth state expired' },
        { status: 400 }
      );
    }

    console.log('OAuth state retrieved successfully for state:', state.substring(0, 8) + '...');

    // Delete the state cookie (one-time use)
    const response = NextResponse.json({
      iss: stateData.iss,
      role: stateData.role,
      codeVerifier: stateData.codeVerifier,
      tokenUrl: stateData.tokenUrl,
      revokeUrl: stateData.revokeUrl,
      launchToken: stateData.launchToken
    });
    response.cookies.delete(cookieName);

    return response;
  } catch (error) {
    console.error('Error retrieving OAuth state:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve OAuth state' },
      { status: 500 }
    );
  }
}
