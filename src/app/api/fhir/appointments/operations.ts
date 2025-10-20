import { FHIRClient } from '@/app/api/fhir/client';
import { manageSlotStatusForAppointment } from '@/app/api/fhir/slots/operations';
import type { Appointment, Bundle } from '@/types/fhir';

/**
 * Search appointments by various parameters
 * FHIR requires date parameters for appointment searches (except when using _id)
 *
 * _id parameter supports:
 * - Single ID: "131249"
 * - Multiple IDs (comma-separated): "131249,131305,131261"
 */
export async function searchAppointments(
  token: string,
  fhirBaseUrl: string,
  patientId?: string,
  practitionerId?: string,
  options?: string | {
    status?: string;
    _count?: number;
    date?: string | string[]; // FHIR date parameter: single value or array for ranges (e.g., ['ge2025-01-01', 'le2025-12-31'])
    _id?: string; // Comma-separated list of IDs for batch fetch
  },
  dateFrom?: string,
  dateTo?: string
): Promise<Bundle<Appointment>> {
  const queryParams = new URLSearchParams();

  // Check if this is a batch fetch by IDs
  let batchIds: string | undefined;
  if (typeof options === 'object' && options._id) {
    batchIds = options._id;
  }

  if (patientId) queryParams.append('patient', patientId);
  if (practitionerId) queryParams.append('practitioner', practitionerId);

  // Handle backward compatibility: options can be a string (old status param) or object
  if (typeof options === 'string') {
    // Legacy usage: third parameter is status string
    queryParams.append('status', options);
  } else if (options && typeof options === 'object') {
    // Pass ALL parameters from options object directly to FHIR API
    // This includes _sort, date, status, _count, _id, and any other FHIR params
    // Backend does NOT add any additional parameters
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        // Skip special keys that are already handled (patient, practitioner)
        if (key === 'patient' || key === 'practitioner') {
          return;
        }
        // Handle array values (e.g., date: ['ge2025-01-01', 'le2025-12-31'])
        if (Array.isArray(value)) {
          value.forEach(v => queryParams.append(key, String(v)));
        } else {
          queryParams.append(key, String(value));
        }
      }
    });
  }

  // If batch fetching by IDs, add _id parameter (FHIR supports comma-separated IDs)
  if (batchIds) {
    queryParams.append('_id', batchIds);
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