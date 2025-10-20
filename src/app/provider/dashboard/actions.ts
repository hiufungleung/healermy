'use server';

import { cookies } from 'next/headers';
import { decrypt } from '@/library/auth/encryption';
import { TOKEN_COOKIE_NAME } from '@/library/auth/config';
import type { SessionData } from '@/types/auth';
import type { Practitioner } from '@/types/fhir';

// Fast session-only function (no FHIR API calls for immediate page render)
export async function getProviderSessionOnly(): Promise<{
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
        session: session,
        error: 'Incomplete session data'
      };
    }

    return {
      session: session
    };
  } catch (error) {
    console.error('Error getting provider session data:', error);
    return {
      session: null,
      error: 'Failed to get session data'
    };
  }
}

// Original function kept for backwards compatibility and direct use
export async function getProviderDashboardData(): Promise<{
  provider: Practitioner | null;
  session: SessionData | null;
  providerName: string;
  error?: string;
}> {
  try {
    // Get session from encrypted HTTP-only cookies
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get(TOKEN_COOKIE_NAME);

    if (!tokenCookie) {
      return {
        provider: null,
        session: null,
        providerName: 'Provider',
        error: 'No session found'
      };
    }

    // Decrypt cookie
    const decryptedSessionString = await decrypt(tokenCookie.value);
    const session: SessionData = JSON.parse(decryptedSessionString);

    // Additional validation for required fields
    if (!session.accessToken || !session.fhirBaseUrl) {
      return {
        provider: null,
        session: session,
        providerName: 'Provider',
        error: 'Incomplete session data'
      };
    }

    // Extract provider information and name
    let providerData: Practitioner | null = null;
    let providerName = 'Provider';

    // Try to get provider name from practitioner ID
    if (session.practitioner) {
      try {
        // Fetch practitioner details from FHIR
        const response = await fetch(`${session.fhirBaseUrl}/Practitioner/${session.practitioner}`, {
          headers: {
            'Authorization': `Bearer ${session.accessToken}`,
            'Accept': 'application/fhir+json',
          },
        });

        if (response.ok) {
          providerData = await response.json();
          if (providerData?.name && providerData.name.length > 0) {
            const name = providerData.name[0];
            const fullName = `${name.prefix ? name.prefix.join(' ') + ' ' : ''}${name.given ? name.given.join(' ') : ''} ${name.family || ''}`.trim();
            providerName = fullName || 'Provider';
          }
        } else {
          console.warn('Failed to fetch practitioner data:', response.status);
        }
      } catch (error) {
        console.error('Error fetching provider data:', error);
        // Continue with default name
      }
    }

    return {
      provider: providerData,
      session: session,
      providerName
    };
  } catch (error) {
    console.error('Error fetching provider dashboard data:', error);
    return {
      provider: null,
      session: null,
      providerName: 'Provider',
      error: 'Failed to fetch provider data'
    };
  }
}