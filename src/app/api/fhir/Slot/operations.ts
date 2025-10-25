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
 * Update slot status using PATCH (Oracle FHIR compliant)
 * Uses official FHIR R4 slot status codes from https://hl7.org/fhir/valueset-slotstatus.html
 */
export async function updateSlotStatus(
  token: string,
  fhirBaseUrl: string,
  slotId: string,
  status: 'busy' | 'free' | 'busy-unavailable' | 'busy-tentative' | 'entered-in-error'
): Promise<any> {
  const patchOperations = [
    {
      op: 'replace',
      path: '/status',
      value: status
    }
  ];

  return patchSlot(token, fhirBaseUrl, slotId, patchOperations);
}

/**
 * Extract slot references from appointment
 */
export function extractSlotReferences(appointment: any): string[] {
  const slotIds: string[] = [];
  
  // Check direct slot reference array
  if (appointment.slot && Array.isArray(appointment.slot)) {
    appointment.slot.forEach((slotRef: any) => {
      if (slotRef.reference && slotRef.reference.startsWith('Slot/')) {
        slotIds.push(slotRef.reference.replace('Slot/', ''));
      }
    });
  }

  // Check extensions for slot references
  if (appointment.extension && Array.isArray(appointment.extension)) {
    appointment.extension.forEach((ext: any) => {
      if (ext.valueReference && ext.valueReference.reference?.startsWith('Slot/')) {
        slotIds.push(ext.valueReference.reference.replace('Slot/', ''));
      }
    });
  }

  return slotIds;
}

/**
 * Automatically manage slot status based on appointment status
 * This is the main function that should be called for all appointment changes
 */
export async function manageSlotStatusForAppointment(
  token: string,
  fhirBaseUrl: string,
  appointment: any,
  oldStatus?: string,
  newStatus?: string
): Promise<void> {
  const slotIds = extractSlotReferences(appointment);
  if (slotIds.length === 0) {
    // No slots to manage - exit gracefully
    return;
  }

  const currentStatus = newStatus || appointment.status;
  
  // Determine what slot status should be based on appointment status
  const targetSlotStatus = getSlotStatusFromAppointmentStatus(currentStatus);
  const oldSlotStatus = oldStatus ? getSlotStatusFromAppointmentStatus(oldStatus) : null;
  
  // Only update if slot status actually needs to change
  if (oldSlotStatus !== targetSlotStatus) {
    for (const slotId of slotIds) {
      try {
        await updateSlotStatus(token, fhirBaseUrl, slotId, targetSlotStatus);
        console.log(`Updated slot ${slotId} from ${oldSlotStatus} to ${targetSlotStatus} (appointment ${appointment.id}: ${oldStatus} -> ${currentStatus})`);
      } catch (error) {
        console.error(`Failed to update slot ${slotId} status:`, error);
        // Continue with other slots even if one fails
      }
    }
  }
}

/**
 * Determine slot status based on appointment status
 * Maps FHIR appointment statuses to official FHIR R4 slot statuses
 * Reference: https://hl7.org/fhir/valueset-slotstatus.html
 */
function getSlotStatusFromAppointmentStatus(appointmentStatus: string): 'busy' | 'free' | 'busy-unavailable' | 'busy-tentative' | 'entered-in-error' {
  switch (appointmentStatus) {
    // busy: Indicates that the time interval is busy because one or more events have been scheduled
    case 'pending':     // BUSY to prevent double-booking while awaiting approval
    case 'booked':      // Confirmed appointment
    case 'arrived':     // Patient has arrived
    case 'checked-in':  // Patient checked in
    case 'fulfilled':   // Appointment completed
      return 'busy';
    
    // busy-tentative: Indicates that the time interval is busy because one or more events have been tentatively scheduled
    case 'proposed':
      return 'busy-tentative';
    
    // free: Indicates that the time interval is free for scheduling
    case 'cancelled':   // Appointment cancelled
    case 'noshow':      // Patient didn't show
    case 'waitlist':    // On waitlist
      return 'free';
    
    // entered-in-error: This instance should not have been part of this patient's medical record
    case 'entered-in-error':
      return 'entered-in-error';
    
    // Default to busy for unknown statuses (safer approach to prevent double-booking)
    default:
      console.warn(`Unknown appointment status: ${appointmentStatus}, defaulting slot to busy for safety`);
      return 'busy';
  }
}

/**
 * Mark slots as busy when appointment is created/confirmed
 * @deprecated Use manageSlotStatusForAppointment instead
 */
export async function markSlotsAsBusy(
  token: string,
  fhirBaseUrl: string,
  appointment: any
): Promise<void> {
  return manageSlotStatusForAppointment(token, fhirBaseUrl, appointment);
}

/**
 * Mark slots as free when appointment is cancelled  
 * @deprecated Use manageSlotStatusForAppointment instead
 */
export async function markSlotsAsFree(
  token: string,
  fhirBaseUrl: string,
  appointment: any
): Promise<void> {
  return manageSlotStatusForAppointment(token, fhirBaseUrl, appointment);
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