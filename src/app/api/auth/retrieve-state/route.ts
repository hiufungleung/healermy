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

    console.log('[RETRIEVE-STATE] 📨 Request received for state:', state?.substring(0, 8) + '...');

    if (!state || typeof state !== 'string') {
      console.error('[RETRIEVE-STATE] ❌ Missing or invalid state parameter');
      return NextResponse.json(
        { error: 'Missing or invalid state parameter' },
        { status: 400 }
      );
    }

    // Retrieve encrypted state from cookie
    const cookieName = `${STATE_COOKIE_PREFIX}${state}`;
    const encryptedState = request.cookies.get(cookieName)?.value;

    console.log('[RETRIEVE-STATE] 🍪 Looking for cookie:', cookieName);
    console.log('[RETRIEVE-STATE] 🍪 Cookie found:', !!encryptedState);

    if (!encryptedState) {
      console.error('[RETRIEVE-STATE] ❌ OAuth state cookie not found:', cookieName);
      console.log('[RETRIEVE-STATE] 🍪 Available cookies:', request.cookies.getAll().map(c => c.name).join(', '));
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

    console.log('[RETRIEVE-STATE] ✅ OAuth state retrieved successfully for state:', state.substring(0, 8) + '...');
    console.log('[RETRIEVE-STATE] 🗑️  Deleting one-time-use cookie:', cookieName);

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

    console.log('[RETRIEVE-STATE] ✅ Response sent with cookie deleted');
    return response;
  } catch (error) {
    console.error('Error retrieving OAuth state:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve OAuth state' },
      { status: 500 }
    );
  }
}
