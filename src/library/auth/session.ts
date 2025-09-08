import { headers } from 'next/headers';
import { AuthSession } from '@/types/auth';

/**
 * Get session data from middleware headers (server-side only)
 * Tokens are already decrypted by middleware
 */
export async function getSessionFromMiddleware(): Promise<AuthSession | null> {
  try {
    const headersList = await headers();
    const sessionHeader = headersList.get('x-session-data');
    
    if (!sessionHeader) {
      console.warn('No session data found in middleware headers');
      return null;
    }

    const session: AuthSession = JSON.parse(sessionHeader);
    return session;
  } catch (error) {
    console.error('Failed to parse session from middleware headers:', error);
    return null;
  }
}

/**
 * Get session data with validation
 */
export async function getValidatedSession(): Promise<{
  session: AuthSession | null;
  error?: string;
}> {
  const session = await getSessionFromMiddleware();
  
  if (!session) {
    return {
      session: null,
      error: 'No session data found'
    };
  }

  // Validate required fields
  if (!session.accessToken || !session.fhirBaseUrl) {
    return {
      session,
      error: 'Incomplete session data'
    };
  }

  return { session };
}