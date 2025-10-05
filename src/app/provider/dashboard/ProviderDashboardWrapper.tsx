'use client';

import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/common/Layout';
import ProviderDashboardClient from './ProviderDashboardClient';
import type { AuthSession } from '@/types/auth';

interface ProviderDashboardWrapperProps {
  session: AuthSession;
}

export default function ProviderDashboardWrapper({
  session
}: ProviderDashboardWrapperProps) {
  const [providerName, setProviderName] = useState<string | undefined>(undefined);

  // Fetch provider name on client-side for Layout update
  useEffect(() => {
    async function fetchProviderName() {
      try {
        let nameFound = false;

        // Extract practitioner ID from fhirUser URL
        if (session.fhirUser) {
          const practitionerMatch = session.fhirUser.match(/\/Practitioner\/(.+)$/);
          if (practitionerMatch) {
            const practitionerId = practitionerMatch[1];

            const response = await fetch(`/api/fhir/practitioners/${practitionerId}`, {
              method: 'GET',
              credentials: 'include',
            });

            if (response.ok) {
              const practitionerData = await response.json();
              if (practitionerData?.name?.[0]) {
                const name = practitionerData.name[0];
                const fullName = `${name.prefix ? name.prefix.join(' ') + ' ' : ''}${name.given ? name.given.join(' ') : ''} ${name.family || ''}`.trim();
                if (fullName) {
                  setProviderName(fullName);
                  nameFound = true;
                }
              }
            }
          }
        }

        // Fallback to session username if practitioner name not found
        if (!nameFound) {
          if (session.username && session.username !== 'portal') {
            setProviderName(session.username);
          } else if (session.user) {
            setProviderName(`HealerMy ${session.user}`);
          } else {
            setProviderName('HealerMy');
          }
        }
      } catch (error) {
        console.error('Error fetching provider name:', error);
        // Set fallback on error
        setProviderName(session.username || 'HealerMy');
      }
    }

    if (session) {
      fetchProviderName();
    }
  }, [session]);

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Morning' : currentHour < 18 ? 'Afternoon' : 'Evening';

  return (
    <Layout providerName={providerName}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ProviderDashboardClient
          provider={null}
          session={session}
          providerName={providerName || 'Provider'}
          greeting={greeting}
        />
      </div>
    </Layout>
  );
}