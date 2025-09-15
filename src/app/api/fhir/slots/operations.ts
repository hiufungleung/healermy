import { FHIRClient } from '../client';

/**
 * Search slots by various parameters
 */
export async function searchSlots(
  token: string,
  fhirBaseUrl: string,
  searchOptions?: {
    schedule?: string;      // Schedule/[id]
    status?: string;        // free, busy, etc.
    start?: string;         // Date range start
    end?: string;          // Date range end
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
  
  const url = `${fhirBaseUrl}/Slot${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await FHIRClient.fetchWithAuth(url, token);
  return response.json();
}

/**
 * Get a slot by ID
 */
export async function getSlot(
  token: string,
  fhirBaseUrl: string,
  slotId: string
): Promise<any> {
  const url = `${fhirBaseUrl}/Slot/${slotId}`;
  const response = await FHIRClient.fetchWithAuth(url, token);
  return response.json();
}

/**
 * Create a new slot
 */
export async function createSlot(
  token: string,
  fhirBaseUrl: string,
  slotData: any
): Promise<any> {
  const url = `${fhirBaseUrl}/Slot`;
  const response = await FHIRClient.fetchWithAuth(url, token, {
    method: 'POST',
    body: JSON.stringify(slotData),
  });
  return response.json();
}

/**
 * Update an existing slot (mainly for status changes)
 */
export async function updateSlot(
  token: string,
  fhirBaseUrl: string,
  slotId: string,
  slotData: any
): Promise<any> {
  const url = `${fhirBaseUrl}/Slot/${slotId}`;
  const response = await FHIRClient.fetchWithAuth(url, token, {
    method: 'PUT',
    body: JSON.stringify(slotData),
  });
  return response.json();
}

/**
 * Patch a slot (for partial updates like status changes)
 */
export async function patchSlot(
  token: string,
  fhirBaseUrl: string,
  slotId: string,
  patchData: any
): Promise<any> {
  const url = `${fhirBaseUrl}/Slot/${slotId}`;
  const response = await FHIRClient.fetchWithAuth(url, token, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json-patch+json'
    },
    body: JSON.stringify(patchData),
  });
  return response.json();
}

/**
 * Delete a slot
 */
export async function deleteSlot(
  token: string,
  fhirBaseUrl: string,
  slotId: string
): Promise<any> {
  const url = `${fhirBaseUrl}/Slot/${slotId}`;
  const response = await FHIRClient.fetchWithAuth(url, token, {
    method: 'DELETE',
  });
  return response.status === 204 ? { success: true } : response.json();
}

/**
 * Generate slots from a schedule
 * This is a utility function to create multiple slots based on a schedule pattern
 */
export async function generateSlotsFromSchedule(
  token: string,
  fhirBaseUrl: string,
  scheduleId: string,
  options: {
    startDate: string;
    endDate: string;
    slotDuration: number; // in minutes
    serviceCategory?: string;
  }
): Promise<any[]> {
  // This would be implemented based on your business logic
  // For now, it's a placeholder for the actual slot generation logic
  const slots: any[] = [];
  
  // Example implementation would:
  // 1. Get the schedule
  // 2. Parse the schedule's planning horizon and available periods  
  // 3. Generate individual slots based on the pattern
  // 4. Create each slot via the FHIR API
  
  return slots;
}