/**
 * Centralized Appointment & Encounter Flow Utilities
 * Follows FHIR R4 compliant flow as documented in APPOINTMENT_ENCOUNTER_FLOW.md
 *
 * Flow Summary:
 * 1. Patient books → pending → provider approves → booked
 * 2. Patient arrives → arrived
 * 3. Practitioner clicks "Will be finished in 10 min" → creates encounter (planned)
 * 4. Practitioner starts encounter → in-progress
 * 5. Practitioner completes encounter → finished + appointment fulfilled
 */

/**
 * Confirm (approve) a pending appointment
 * Changes status from 'pending' to 'booked'
 * Returns the updated appointment resource from PATCH response
 */
export async function confirmAppointment(appointmentId: string): Promise<any> {
  const response = await fetch(`/api/fhir/appointments/${appointmentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json-patch+json' },
    credentials: 'include',
    body: JSON.stringify([
      { op: 'replace', path: '/status', value: 'booked' }
    ])
  });

  if (!response.ok) {
    throw new Error('Failed to confirm appointment');
  }

  return response.json(); // Return updated appointment
}

/**
 * Cancel an appointment
 * Changes status to 'cancelled' and frees up the slot
 * Returns the updated appointment resource from PATCH response
 */
export async function cancelAppointment(appointmentId: string): Promise<any> {
  const response = await fetch(`/api/fhir/appointments/${appointmentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json-patch+json' },
    credentials: 'include',
    body: JSON.stringify([
      { op: 'replace', path: '/status', value: 'cancelled' }
    ])
  });

  if (!response.ok) {
    throw new Error('Failed to cancel appointment');
  }

  return response.json(); // Return updated appointment
}

/**
 * Mark patient as arrived
 * Changes appointment status from 'booked' to 'arrived'
 * Returns the updated appointment resource from PATCH response
 */
export async function markPatientArrived(appointmentId: string): Promise<any> {
  const response = await fetch(`/api/fhir/appointments/${appointmentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json-patch+json' },
    credentials: 'include',
    body: JSON.stringify([
      { op: 'replace', path: '/status', value: 'arrived' }
    ])
  });

  if (!response.ok) {
    throw new Error('Failed to mark patient as arrived');
  }

  return response.json(); // Return updated appointment
}

/**
 * Create encounter for an arrived patient (status: 'planned')
 * This is called when practitioner clicks "Will be finished in 10 minutes" for the next patient
 * Returns the created encounter resource
 */
export async function createPlannedEncounter(appointmentId: string): Promise<any> {
  const response = await fetch('/api/fhir/encounters/create-for-appointment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      appointmentId,
      initialStatus: 'planned'
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to create encounter');
  }

  return response.json(); // Return created encounter
}

/**
 * Start an encounter
 * Changes encounter status from 'planned' to 'in-progress'
 * Automatically sets period.start timestamp
 * Returns the updated encounter resource from PATCH response
 */
export async function startEncounter(encounterId: string): Promise<any> {
  const response = await fetch(`/api/fhir/encounters/${encounterId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json-patch+json' },
    credentials: 'include',
    body: JSON.stringify([
      { op: 'replace', path: '/status', value: 'in-progress' }
    ])
  });

  if (!response.ok) {
    throw new Error('Failed to start encounter');
  }

  return response.json(); // Return updated encounter
}

/**
 * Mark encounter as "will be finished soon" (on-hold status)
 * This notifies the patient that the appointment will begin within 10 minutes
 * Returns the updated encounter resource from PATCH response
 */
export async function markEncounterFinishingSoon(encounterId: string): Promise<any> {
  const response = await fetch(`/api/fhir/encounters/${encounterId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json-patch+json' },
    credentials: 'include',
    body: JSON.stringify([
      { op: 'replace', path: '/status', value: 'on-hold' }
    ])
  });

  if (!response.ok) {
    throw new Error('Failed to mark encounter as finishing soon');
  }

  return response.json(); // Return updated encounter
}

/**
 * Complete (finalize) an encounter
 * Changes encounter status from 'in-progress' to 'finished'
 * Automatically sets period.end timestamp
 * Also changes appointment status to 'fulfilled'
 * Both PATCH requests sent in parallel for better performance
 * Returns both updated encounter and appointment
 */
export async function completeEncounter(encounterId: string, appointmentId: string): Promise<{ appointment: any; encounter: any }> {
  // Send both PATCH requests in parallel
  const [encounterResponse, appointmentResponse] = await Promise.all([
    // Update encounter to finished
    fetch(`/api/fhir/encounters/${encounterId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json-patch+json' },
      credentials: 'include',
      body: JSON.stringify([
        { op: 'replace', path: '/status', value: 'finished' }
      ])
    }),
    // Update appointment to fulfilled
    fetch(`/api/fhir/appointments/${appointmentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json-patch+json' },
      credentials: 'include',
      body: JSON.stringify([
        { op: 'replace', path: '/status', value: 'fulfilled' }
      ])
    })
  ]);

  // Check both responses
  if (!encounterResponse.ok) {
    throw new Error('Failed to complete encounter');
  }

  if (!appointmentResponse.ok) {
    throw new Error('Failed to mark appointment as fulfilled');
  }

  // Parse both responses in parallel
  const [updatedEncounter, updatedAppointment] = await Promise.all([
    encounterResponse.json(),
    appointmentResponse.json()
  ]);

  return { appointment: updatedAppointment, encounter: updatedEncounter };
}

/**
 * Get available actions for an appointment based on its status and encounter status
 * Returns array of action identifiers that can be performed
 */
export function getAvailableActions(
  appointmentStatus: string,
  encounterStatus?: string
): string[] {
  const actions: string[] = [];

  // Pending appointments
  if (appointmentStatus === 'pending') {
    actions.push('confirm', 'cancel');
    return actions;
  }

  // Booked appointments
  if (appointmentStatus === 'booked') {
    actions.push('cancel', 'mark-arrived');
    return actions;
  }

  // Arrived appointments without encounter
  if (appointmentStatus === 'arrived' && !encounterStatus) {
    actions.push('start-encounter');
    return actions;
  }

  // Encounter-based actions
  if (encounterStatus) {
    if (encounterStatus === 'planned') {
      actions.push('start-encounter');
    }

    if (encounterStatus === 'in-progress') {
      actions.push('will-be-finished', 'complete-encounter');
    }
  }

  // Cancelled appointments have no actions
  if (appointmentStatus === 'cancelled') {
    return [];
  }

  return actions;
}

/**
 * Get human-readable label for an action
 */
export function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    'confirm': 'Confirm',
    'cancel': 'Cancel',
    'mark-arrived': 'Patient Arrived',
    'start-encounter': 'Start Encounter',
    'will-be-finished': 'Will be Finished Soon',
    'complete-encounter': 'Complete Encounter'
  };

  return labels[action] || action;
}

/**
 * Execute an action on an appointment/encounter
 * Returns the updated appointment data (and encounter if applicable)
 */
export async function executeAction(
  action: string,
  appointmentId: string,
  encounterId?: string
): Promise<{ appointment?: any; encounter?: any }> {
  switch (action) {
    case 'confirm':
      const confirmedAppointment = await confirmAppointment(appointmentId);
      return { appointment: confirmedAppointment };

    case 'cancel':
      const cancelledAppointment = await cancelAppointment(appointmentId);
      return { appointment: cancelledAppointment };

    case 'mark-arrived':
      const arrivedAppointment = await markPatientArrived(appointmentId);
      return { appointment: arrivedAppointment };

    case 'start-encounter':
      if (encounterId) {
        const updatedEncounter = await startEncounter(encounterId);
        return { encounter: updatedEncounter };
      } else {
        // Create encounter for arrived patient
        const newEncounter = await createPlannedEncounter(appointmentId);
        return { encounter: newEncounter };
      }

    case 'will-be-finished':
      if (!encounterId) {
        throw new Error('Encounter ID required for this action');
      }
      const onHoldEncounter = await markEncounterFinishingSoon(encounterId);
      return { encounter: onHoldEncounter };

    case 'complete-encounter':
      if (!encounterId) {
        throw new Error('Encounter ID required for this action');
      }
      const result = await completeEncounter(encounterId, appointmentId);
      return result; // Returns both appointment and encounter

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}
