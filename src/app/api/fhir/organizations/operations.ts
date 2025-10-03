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
  params: {
    name?: string;
    active?: boolean;
    type?: string;
    _count?: number;
    _sort?: string;
  } = {}
): Promise<Bundle<Organization>> {
  const queryParams = new URLSearchParams();

  if (params.name) queryParams.append('name', params.name);
  if (params.active !== undefined) queryParams.append('active', String(params.active));
  if (params.type) queryParams.append('type', params.type);
  if (params._count) queryParams.append('_count', String(params._count));
  if (params._sort) queryParams.append('_sort', params._sort);

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
