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
 */
export async function confirmAppointment(appointmentId: string): Promise<void> {
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
}

/**
 * Cancel an appointment
 * Changes status to 'cancelled' and frees up the slot
 */
export async function cancelAppointment(appointmentId: string): Promise<void> {
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
}

/**
 * Mark patient as arrived
 * Changes appointment status from 'booked' to 'arrived'
 */
export async function markPatientArrived(appointmentId: string): Promise<void> {
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
}

/**
 * Create encounter for an arrived patient (status: 'planned')
 * This is called when practitioner clicks "Will be finished in 10 minutes" for the next patient
 */
export async function createPlannedEncounter(appointmentId: string): Promise<void> {
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
}

/**
 * Start an encounter
 * Changes encounter status from 'planned' to 'in-progress'
 * Automatically sets period.start timestamp
 */
export async function startEncounter(encounterId: string): Promise<void> {
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
}

/**
 * Mark encounter as "will be finished soon" (on-hold status)
 * This notifies the patient that the appointment will begin within 10 minutes
 */
export async function markEncounterFinishingSoon(encounterId: string): Promise<void> {
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
}

/**
 * Complete (finalize) an encounter
 * Changes encounter status from 'in-progress' to 'finished'
 * Automatically sets period.end timestamp
 * Also changes appointment status to 'fulfilled'
 */
export async function completeEncounter(encounterId: string, appointmentId: string): Promise<void> {
  // Update encounter to finished
  const encounterResponse = await fetch(`/api/fhir/encounters/${encounterId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json-patch+json' },
    credentials: 'include',
    body: JSON.stringify([
      { op: 'replace', path: '/status', value: 'finished' }
    ])
  });

  if (!encounterResponse.ok) {
    throw new Error('Failed to complete encounter');
  }

  // Update appointment to fulfilled
  const appointmentResponse = await fetch(`/api/fhir/appointments/${appointmentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json-patch+json' },
    credentials: 'include',
    body: JSON.stringify([
      { op: 'replace', path: '/status', value: 'fulfilled' }
    ])
  });

  if (!appointmentResponse.ok) {
    throw new Error('Failed to mark appointment as fulfilled');
  }
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
 */
export async function executeAction(
  action: string,
  appointmentId: string,
  encounterId?: string
): Promise<void> {
  switch (action) {
    case 'confirm':
      return confirmAppointment(appointmentId);

    case 'cancel':
      return cancelAppointment(appointmentId);

    case 'mark-arrived':
      return markPatientArrived(appointmentId);

    case 'start-encounter':
      if (encounterId) {
        return startEncounter(encounterId);
      } else {
        // Create encounter for arrived patient
        return createPlannedEncounter(appointmentId);
      }

    case 'will-be-finished':
      if (!encounterId) {
        throw new Error('Encounter ID required for this action');
      }
      return markEncounterFinishingSoon(encounterId);

    case 'complete-encounter':
      if (!encounterId) {
        throw new Error('Encounter ID required for this action');
      }
      return completeEncounter(encounterId, appointmentId);

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}
