import { FHIRClient } from '@/app/api/fhir/client';
import { manageSlotStatusForAppointment } from '@/app/api/fhir/Slot/operations';
import type { Appointment, Bundle } from '@/types/fhir';

/**
 * Search appointments by various parameters
 * Simply passes all query parameters to FHIR API without processing
 */
export async function searchAppointments(
  token: string,
  fhirBaseUrl: string,
  queryParams: URLSearchParams
): Promise<Bundle<Appointment>> {
  // Pass all query parameters directly to FHIR API
  // URLSearchParams preserves duplicate keys (e.g., multiple date parameters)
  const url = `${fhirBaseUrl}/Appointment?${queryParams.toString()}`;
  const response = await FHIRClient.fetchWithAuth(url, token);
  const bundle = await response.json();

  // Return the full FHIR Bundle structure
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