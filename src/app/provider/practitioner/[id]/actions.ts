'use server';

import { cookies } from 'next/headers';
import { decrypt } from '@/lib/auth/encryption';
import { TOKEN_COOKIE_NAME } from '@/lib/auth/config';
import type { SessionData } from '@/types/auth';

// Server action that gets session data immediately - no API calls for fast response
export async function getBasicSessionData(): Promise<{
  session: SessionData | null;
  error?: string;
}> {
  try {
    // Get session from encrypted HTTP-only cookies
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get(TOKEN_COOKIE_NAME);

    if (!tokenCookie) {
      return {
        session: null,
        error: 'No session found'
      };
    }

    // Decrypt cookie
    const decryptedSessionString = await decrypt(tokenCookie.value);
    const session: SessionData = JSON.parse(decryptedSessionString);

    // Additional validation for required fields
    if (!session.accessToken || !session.fhirBaseUrl) {
      return {
        session: session as SessionData,
        error: 'Incomplete session data'
      };
    }

    // Return session immediately - no API calls for fastest response
    return {
      session: session as SessionData
    };
  } catch (error) {
    console.error('Error getting basic session data:', error);
    return {
      session: null,
      error: 'Failed to get session data'
    };
  }
}