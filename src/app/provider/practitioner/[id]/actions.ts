'use server';

import { cookies } from 'next/headers';
import { decrypt } from '@/library/auth/encryption';
import { SESSION_COOKIE_NAME, TOKEN_COOKIE_NAME } from '@/library/auth/config';
import type { AuthSession, TokenData, SessionData } from '@/types/auth';

// Server action that gets session data immediately - no API calls for fast response
export async function getBasicSessionData(): Promise<{
  session: AuthSession | null;
  error?: string;
}> {
  try {
    // Get session from encrypted HTTP-only cookies
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get(TOKEN_COOKIE_NAME);
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

    if (!tokenCookie || !sessionCookie) {
      return {
        session: null,
        error: 'No session found'
      };
    }

    // Decrypt both cookie parts
    const decryptedTokenString = await decrypt(tokenCookie.value);
    const decryptedSessionString = await decrypt(sessionCookie.value);

    const tokenData: TokenData = JSON.parse(decryptedTokenString);
    const sessionMetadata: SessionData = JSON.parse(decryptedSessionString);

    // Combine into single session object
    const session: AuthSession = {
      ...tokenData,
      ...sessionMetadata
    };

    // Additional validation for required fields
    if (!session.accessToken || !session.fhirBaseUrl) {
      return {
        session,
        error: 'Incomplete session data'
      };
    }

    // Return session immediately - no API calls for fastest response
    return {
      session
    };
  } catch (error) {
    console.error('Error getting basic session data:', error);
    return {
      session: null,
      error: 'Failed to get session data'
    };
  }
}