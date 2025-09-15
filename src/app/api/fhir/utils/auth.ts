import { headers } from 'next/headers';
import type { AuthSession } from '@/types/auth';

/**
 * Extract session from middleware headers
 * Middleware already handles decryption and validation
 */
export async function getSessionFromHeaders(): Promise<AuthSession> {
  const headersList = await headers();
  const sessionHeader = headersList.get('x-session-data');
  
  if (!sessionHeader) {
    throw new Error('No session found');
  }

  const session: AuthSession = JSON.parse(sessionHeader);
  
  if (!session.accessToken || !session.fhirBaseUrl) {
    throw new Error('Incomplete session data');
  }

  return session;
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