import { cookies } from 'next/headers';
import type { AuthSession, TokenData, SessionData } from '../../../../types/auth';
import { decrypt } from '../../../../library/auth/encryption';
import { SESSION_COOKIE_NAME, TOKEN_COOKIE_NAME } from '../../../../library/auth/config';

/**
 * Extract and decrypt session from HTTP-only cookies
 * This is the ONLY secure way to access session data in API routes
 * Never expose session data in response headers or client-side code
 */
export async function getSessionFromCookies(): Promise<AuthSession> {
  const cookieStore = await cookies();
  const tokenCookie = cookieStore.get(TOKEN_COOKIE_NAME);
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (!tokenCookie || !sessionCookie) {
    throw new Error('No session found - authentication required');
  }

  try {
    // Decrypt both cookie parts (same encryption as middleware)
    const decryptedTokenString = await decrypt(tokenCookie.value);
    const decryptedSessionString = await decrypt(sessionCookie.value);

    const tokenData: TokenData = JSON.parse(decryptedTokenString);
    const sessionMetadata: SessionData = JSON.parse(decryptedSessionString);

    // Combine into single session object for compatibility
    const session: AuthSession = {
      ...tokenData,
      ...sessionMetadata
    };

    if (!session.accessToken || !session.fhirBaseUrl) {
      throw new Error('Incomplete session data');
    }

    return session;
  } catch (error) {
    throw new Error('Session decryption failed - invalid or corrupted session');
  }
}

/**
 * @deprecated Use getSessionFromCookies() instead
 * This function is kept for backward compatibility but should not be used
 */
export async function getSessionFromHeaders(): Promise<AuthSession> {
  throw new Error('getSessionFromHeaders() is deprecated - use getSessionFromCookies() for security');
}

/**
 * Check if user has required role
 */
export function validateRole(session: AuthSession, requiredRole: 'patient' | 'provider'): void {
  if (session.role !== requiredRole) {
    throw new Error(`Unauthorized: ${requiredRole} role required`);
  }
}

/**
 * Clean and prepare access token
 */
export function prepareToken(token: string): string {
  return token.trim();
}