import { FHIRClient } from '../client';
import type { Organization, Bundle } from '@/types/fhir';

export async function getOrganization(
  token: string,
  fhirBaseUrl: string,
  organizationId: string
): Promise<Organization> {
  const url = `${fhirBaseUrl}/Organization/${organizationId}`;
  const response = await FHIRClient.fetchWithAuth(url, token);
  return response.json();
}

export async function searchOrganizations(
  token: string,
  fhirBaseUrl: string,
  params: Record<string, string | boolean | number> = {}
): Promise<Bundle<Organization>> {
  const queryParams = new URLSearchParams();

  // Pass ALL parameters directly to FHIR API without filtering
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams.append(key, String(value));
    }
  });

  const url = `${fhirBaseUrl}/Organization?${queryParams.toString()}`;
  const response = await FHIRClient.fetchWithAuth(url, token);
  return response.json();
}

export async function createOrganization(
  token: string,
  fhirBaseUrl: string,
  organizationData: Partial<Organization>
): Promise<Organization> {
  const url = `${fhirBaseUrl}/Organization`;

  const organization: Partial<Organization> = {
    resourceType: 'Organization',
    ...organizationData
  };

  const response = await FHIRClient.fetchWithAuth(url, token, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/fhir+json',
    },
    body: JSON.stringify(organization),
  });

  return response.json();
}
