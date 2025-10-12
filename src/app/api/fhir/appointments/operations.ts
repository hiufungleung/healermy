import { FHIRClient } from '@/app/api/fhir/client';
import { manageSlotStatusForAppointment } from '@/app/api/fhir/slots/operations';
import type { Appointment, Bundle } from '@/types/fhir';

/**
 * Search appointments by various parameters
 * FHIR requires date parameters for appointment searches
 */
export async function searchAppointments(
  token: string,
  fhirBaseUrl: string,
  patientId?: string,
  practitionerId?: string,
  options?: string | {
    status?: string;
    _count?: number;
    'date-from'?: string;
    'date-to'?: string;
  },
  dateFrom?: string,
  dateTo?: string
): Promise<Bundle<Appointment>> {
  const queryParams = new URLSearchParams();
  
  if (patientId) queryParams.append('patient', patientId);
  if (practitionerId) queryParams.append('practitioner', practitionerId);
  
  // Handle backward compatibility: options can be a string (old status param) or object
  let status: string | undefined;
  let count: number | undefined;
  let optionsDateFrom: string | undefined;
  let optionsDateTo: string | undefined;

  if (typeof options === 'string') {
    // Legacy usage: third parameter is status string
    status = options;
  } else if (options && typeof options === 'object') {
    // New usage: third parameter is options object
    status = options.status;
    count = options._count;
    optionsDateFrom = options['date-from'];
    optionsDateTo = options['date-to'];
  }

  if (status) queryParams.append('status', status);
  if (count) queryParams.append('_count', count.toString());

  // Use date parameters from options object first, then fall back to function parameters
  const finalDateFrom = optionsDateFrom || dateFrom;
  const finalDateTo = optionsDateTo || dateTo;

  // FHIR requires date parameters with time component and timezone (per swagger.json)
  if (finalDateFrom) {
    // If dateFrom provided, ensure it has time component
    const fromDate = finalDateFrom.includes('T') ? finalDateFrom : `${finalDateFrom}T00:00:00.000Z`;
    queryParams.append('date', `ge${fromDate}`);

    if (finalDateTo) {
      // If dateTo also provided, add upper bound
      const toDate = finalDateTo.includes('T') ? finalDateTo : `${finalDateTo}T23:59:59.999Z`;
      queryParams.append('date', `le${toDate}`);
    }
  } else {
    // Default to appointments from 30 days ago at start of day to 90 days in future
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    queryParams.append('date', `ge${thirtyDaysAgo.toISOString()}`);
    
    const ninetyDaysFromNow = new Date();
    ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);
    ninetyDaysFromNow.setHours(23, 59, 59, 999);
    queryParams.append('date', `le${ninetyDaysFromNow.toISOString()}`);
  }
  
  const url = `${fhirBaseUrl}/Appointment?${queryParams.toString()}`;
  const response = await FHIRClient.fetchWithAuth(url, token);
  const bundle = await response.json();
  
  // Return the full FHIR Bundle structure
  // Some callers expect `result.entry`, others expect the resources directly
  if (bundle.resourceType === 'Bundle') {
    return bundle as Bundle<Appointment>;
  }
  
  // Fallback to empty Bundle if no valid bundle structure
  return {
    resourceType: 'Bundle',
    type: 'searchset',
    entry: []
  } as Bundle<Appointment>;
}

/**
 * Create a new appointment and manage slot status
 */
export async function createAppointment(
  token: string,
  fhirBaseUrl: string,
  appointmentData: Partial<Appointment>
): Promise<Appointment> {
  const url = `${fhirBaseUrl}/Appointment`;
  const response = await FHIRClient.fetchWithAuth(url, token, {
    method: 'POST',
    body: JSON.stringify(appointmentData),
  });

  const result: Appointment = await response.json();
  
  // Automatically manage slot status based on appointment status
  if (response.ok) {
    try {
      await manageSlotStatusForAppointment(token, fhirBaseUrl, appointmentData, undefined, appointmentData.status);
    } catch (slotError) {
      console.warn('Failed to update slot status after appointment creation:', slotError);
      // Don't fail the appointment creation if slot update fails
    }
  }
  
  return result;
}

/**
 * Update an appointment and manage slot status
 */
export async function updateAppointment(
  token: string,
  fhirBaseUrl: string,
  appointmentId: string,
  appointmentData: Partial<Appointment>,
  oldStatus?: string
): Promise<Appointment> {
  const url = `${fhirBaseUrl}/Appointment/${appointmentId}`;
  const response = await FHIRClient.fetchWithAuth(url, token, {
    method: 'PUT',
    body: JSON.stringify(appointmentData),
  });

  const result: Appointment = await response.json();
  
  // Automatically manage slot status based on appointment status changes
  if (response.ok) {
    try {
      await manageSlotStatusForAppointment(token, fhirBaseUrl, appointmentData, oldStatus, appointmentData.status);
    } catch (slotError) {
      console.warn('Failed to update slot status after appointment update:', slotError);
      // Don't fail the appointment update if slot update fails
    }
  }
  
  return result;
}