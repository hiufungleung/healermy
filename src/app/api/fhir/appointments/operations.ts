import { FHIRClient } from '../client';

/**
 * Search appointments by various parameters
 * FHIR requires date parameters for appointment searches
 */
export async function searchAppointments(
  token: string,
  fhirBaseUrl: string,
  patientId?: string,
  practitionerId?: string,
  status?: string,
  dateFrom?: string,
  dateTo?: string
): Promise<any> {
  const queryParams = new URLSearchParams();
  
  if (patientId) queryParams.append('patient', patientId);
  if (practitionerId) queryParams.append('practitioner', practitionerId);
  if (status) queryParams.append('status', status);
  
  // FHIR requires date parameters with time component and timezone (per swagger.json)
  if (dateFrom) {
    // If dateFrom provided, ensure it has time component
    const fromDate = dateFrom.includes('T') ? dateFrom : `${dateFrom}T00:00:00.000Z`;
    queryParams.append('date', `ge${fromDate}`);
  } else {
    // Default to appointments from 30 days ago at start of day
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    queryParams.append('date', `ge${thirtyDaysAgo.toISOString()}`);
  }
  
  if (dateTo) {
    // If dateTo provided, ensure it has time component
    const toDate = dateTo.includes('T') ? dateTo : `${dateTo}T23:59:59.999Z`;
    queryParams.append('date', `lt${toDate}`);
  } else {
    // Default to appointments up to 90 days in the future at end of day
    const ninetyDaysFromNow = new Date();
    ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);
    ninetyDaysFromNow.setHours(23, 59, 59, 999);
    queryParams.append('date', `lt${ninetyDaysFromNow.toISOString()}`);
  }
  
  const url = `${fhirBaseUrl}/Appointment?${queryParams.toString()}`;
  const response = await FHIRClient.fetchWithAuth(url, token);
  const bundle = await response.json();
  
  // Extract appointments from FHIR Bundle
  if (bundle.resourceType === 'Bundle' && bundle.entry) {
    return bundle.entry.map((entry: any) => entry.resource).filter((resource: any) => resource);
  }
  
  // Fallback to empty array if no valid bundle structure
  return [];
}

/**
 * Create a new appointment
 */
export async function createAppointment(
  token: string,
  fhirBaseUrl: string,
  appointmentData: any
): Promise<any> {
  const url = `${fhirBaseUrl}/Appointment`;
  const response = await FHIRClient.fetchWithAuth(url, token, {
    method: 'POST',
    body: JSON.stringify(appointmentData),
  });
  return response.json();
}

/**
 * Update an appointment
 */
export async function updateAppointment(
  token: string,
  fhirBaseUrl: string,
  appointmentId: string,
  appointmentData: any
): Promise<any> {
  const url = `${fhirBaseUrl}/Appointment/${appointmentId}`;
  const response = await FHIRClient.fetchWithAuth(url, token, {
    method: 'PUT',
    body: JSON.stringify(appointmentData),
  });
  return response.json();
}