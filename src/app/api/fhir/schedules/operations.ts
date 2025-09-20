import { FHIRClient } from '../client';

/**
 * Search schedules by practitioner ID - Direct FHIR query approach
 */
export async function searchSchedules(
  token: string,
  fhirBaseUrl: string,
  searchOptions?: {
    actor?: string;   // Practitioner/{id}
    date?: string;    // Date range with ge/le comparators
    specialty?: string;
    _count?: number;
  }
): Promise<any> {
  const queryParams = new URLSearchParams();

  // Add search parameters directly as provided
  if (searchOptions) {
    Object.entries(searchOptions).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams.append(key, value.toString());
      }
    });
  }

  const url = `${fhirBaseUrl}/Schedule?${queryParams.toString()}`;
  console.log('Schedule query URL:', url);

  const response = await FHIRClient.fetchWithAuth(url, token);
  const result = await response.json();

  console.log('Schedule query result:', result);
  return result;
}

/**
 * Get a schedule by ID
 */
export async function getSchedule(
  token: string,
  fhirBaseUrl: string,
  scheduleId: string
): Promise<any> {
  const url = `${fhirBaseUrl}/Schedule/${scheduleId}`;
  const response = await FHIRClient.fetchWithAuth(url, token);
  return response.json();
}

/**
 * Create a new schedule
 */
export async function createSchedule(
  token: string,
  fhirBaseUrl: string,
  scheduleData: any
): Promise<any> {
  const url = `${fhirBaseUrl}/Schedule`;
  const response = await FHIRClient.fetchWithAuth(url, token, {
    method: 'POST',
    body: JSON.stringify(scheduleData),
  });
  return response.json();
}

/**
 * Update an existing schedule
 */
export async function updateSchedule(
  token: string,
  fhirBaseUrl: string,
  scheduleId: string,
  scheduleData: any
): Promise<any> {
  const url = `${fhirBaseUrl}/Schedule/${scheduleId}`;
  const response = await FHIRClient.fetchWithAuth(url, token, {
    method: 'PUT',
    body: JSON.stringify(scheduleData),
  });
  return response.json();
}

/**
 * Delete a schedule
 */
export async function deleteSchedule(
  token: string,
  fhirBaseUrl: string,
  scheduleId: string
): Promise<any> {
  const url = `${fhirBaseUrl}/Schedule/${scheduleId}`;
  const response = await FHIRClient.fetchWithAuth(url, token, {
    method: 'DELETE',
  });
  return response.status === 204 ? { success: true } : response.json();
}