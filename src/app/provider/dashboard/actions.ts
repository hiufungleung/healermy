'use server';

import { headers } from 'next/headers';
import type { AuthSession } from '@/types/auth';
import type { Practitioner } from '@/types/fhir';

// Fast session-only function (no FHIR API calls for immediate page render)
export async function getProviderSessionOnly(): Promise<{
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

    return {
      session
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
  session: AuthSession | null;
  providerName: string;
  error?: string;
}> {
  try {
    // Get session directly from middleware headers (already decrypted and validated)
    const headersList = await headers();
    const sessionHeader = headersList.get('x-session-data');

    if (!sessionHeader) {
      return {
        provider: null,
        session: null,
        providerName: 'Provider',
        error: 'No session found'
      };
    }

    const session: AuthSession = JSON.parse(sessionHeader);

    // Additional validation for required fields
    if (!session.accessToken || !session.fhirBaseUrl) {
      return {
        provider: null,
        session,
        providerName: 'Provider',
        error: 'Incomplete session data'
      };
    }

    // Extract provider information and name
    let providerData: Practitioner | null = null;
    let providerName = 'Provider';

    // Try to get provider name from fhirUser
    if (session.fhirUser) {
      try {
        // Extract practitioner ID from fhirUser URL
        const practitionerMatch = session.fhirUser.match(/\/Practitioner\/(.+)$/);
        if (practitionerMatch) {
          const practitionerId = practitionerMatch[1];

          // Fetch practitioner details from FHIR
          const response = await fetch(`${session.fhirBaseUrl}/Practitioner/${practitionerId}`, {
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
        }
      } catch (error) {
        console.error('Error fetching provider data:', error);
        // Continue with default name
      }
    }

    // If we still don't have a name, try to use session.user or username
    if (providerName === 'Provider') {
      if (session.username && session.username !== 'portal') {
        providerName = session.username;
      } else if (session.user) {
        providerName = `Provider ${session.user}`;
      }
    }

    return {
      provider: providerData,
      session,
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