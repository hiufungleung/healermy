import { Suspense } from 'react';
import ProviderNotificationsClient from './ProviderNotificationsClient';
import { Layout } from '@/components/common/Layout';

// Extract practitioner name from FHIR Practitioner resource
function extractPractitionerName(practitioner: any): string {
  if (!practitioner?.name?.[0]) return 'Provider';

  const name = practitioner.name[0];
  const given = Array.isArray(name.given) ? name.given.join(' ') : name.given || '';
  const family = name.family || '';

  return `${given} ${family}`.trim() || 'Provider';
}

async function fetchPractitionerData() {
  // This would typically fetch practitioner data from session or API
  // For now, we'll return a placeholder
  return {
    id: 'provider-1',
    name: [{ family: 'Johnson', given: ['Dr. Sarah'] }]
  };
}

async function fetchCommunications() {
  // This would fetch communications from FHIR API
  // For now, we'll return empty array - the client component will handle fetching
  return [];
}

export default async function ProviderNotificationsPage() {
  const practitioner = await fetchPractitionerData();
  const communications = await fetchCommunications();
  const practitionerName = extractPractitionerName(practitioner);

  return (
    <Layout providerName={practitionerName}>
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-pulse text-text-secondary">Loading notifications...</div>
        </div>
      }>
        <ProviderNotificationsClient
          practitioner={practitioner}
          communications={communications}
          practitionerName={practitionerName}
        />
      </Suspense>
    </Layout>
  );
}