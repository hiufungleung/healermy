import { FHIRClient } from '../client';

/**
 * Search schedules by practitioner ID
 */
export async function searchSchedules(
  token: string,
  fhirBaseUrl: string,
  searchOptions?: {
    actor?: string; // Practitioner/[id]
    date?: string;   // Date range
    _count?: number;
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
  
  const url = `${fhirBaseUrl}/Schedule${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await FHIRClient.fetchWithAuth(url, token);
  return response.json();
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