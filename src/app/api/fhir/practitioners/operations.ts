import { FHIRClient } from '../client';

/**
 * Search practitioners by various parameters
 */
export async function searchPractitioners(
  token: string,
  fhirBaseUrl: string,
  searchOptions?: {
    given?: string;
    family?: string;
    telecom?: string;
    'address-city'?: string;
    'address-state'?: string;
    'address-postalcode'?: string;
    'address-country'?: string;
    _id?: string;
    _count?: number;
    _getpages?: string;
  }
): Promise<any> {
  const queryParams = new URLSearchParams();
  
  if (searchOptions) {
    Object.entries(searchOptions).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams.append(key, value.toString());
      }
    });
  }
  
  const url = `${fhirBaseUrl}/Practitioner${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await FHIRClient.fetchWithAuth(url, token);
  return response.json();
}

/**
 * Get a practitioner by ID
 */
export async function getPractitioner(
  token: string,
  fhirBaseUrl: string,
  practitionerId: string
): Promise<any> {
  const url = `${fhirBaseUrl}/Practitioner/${practitionerId}`;
  const response = await FHIRClient.fetchWithAuth(url, token);
  return response.json();
}

/**
 * Create a new practitioner
 */
export async function createPractitioner(
  token: string,
  fhirBaseUrl: string,
  practitionerData: any
): Promise<any> {
  const url = `${fhirBaseUrl}/Practitioner`;
  const response = await FHIRClient.fetchWithAuth(url, token, {
    method: 'POST',
    body: JSON.stringify(practitionerData),
  });
  return response.json();
}