import { cookies } from 'next/headers';
import type { SessionData } from '@/types/auth';
import { decrypt } from '@/library/auth/encryption';
import { TOKEN_COOKIE_NAME } from '@/library/auth/config';

/**
 * Extract and decrypt session from HTTP-only cookie
 * This is the ONLY secure way to access session data in API routes
 * Never expose session data in response headers or client-side code
 */
export async function getSessionFromCookies(): Promise<SessionData> {
  const cookieStore = await cookies();
  const tokenCookie = cookieStore.get(TOKEN_COOKIE_NAME);

  if (!tokenCookie) {
    throw new Error('No session found - authentication required');
  }

  try {
    // Decrypt session cookie
    const decryptedSessionString = await decrypt(tokenCookie.value);
    const session: SessionData = JSON.parse(decryptedSessionString);

    if (!session.accessToken || !session.fhirBaseUrl) {
      throw new Error('Incomplete session data');
    }

    return session;
  } catch (error) {
    throw new Error('Session decryption failed - invalid or corrupted session');
  }
}

/**
 * Check if user has required role
 */
export function validateRole(session: SessionData, requiredRole: 'patient' | 'provider' | 'practitioner'): void {
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