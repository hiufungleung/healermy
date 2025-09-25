'use server';

import { headers } from 'next/headers';
import type { AuthSession } from '@/types/auth';

// Server action that gets session data immediately - no API calls for fast response
export async function getBasicSessionData(): Promise<{
  session: AuthSession | null;
  error?: string;
}> {
  try {
    // Get session directly from middleware headers (already decrypted and validated)
    const headersList = await headers();
    const sessionHeader = headersList.get('x-session-data');

    if (!sessionHeader) {
      return {
        session: null,
        error: 'No session found'
      };
    }

    const session: AuthSession = JSON.parse(sessionHeader);

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