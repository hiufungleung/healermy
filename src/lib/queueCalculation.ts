import type { Encounter } from '@/types/fhir';

/**
 * Calculate queue position for a patient based on encounters before their appointment
 *
 * @param patientAppointmentStart - ISO date string of patient's appointment start time
 * @param encounters - List of all encounters for the practitioner/location
 * @param patientEncounter - Optional: Patient's own encounter to check status
 * @returns Object with queue position, estimated wait time, and special status flags
 */
export function calculateQueuePosition(
  patientAppointmentStart: string,
  encounters: Encounter[],
  patientEncounter?: Encounter
): {
  position: number;
  encountersAhead: number;
  estimatedWaitMinutes: number;
  isOnHold: boolean;
  hasInProgressAhead: boolean;
} {
  // Check if patient's own encounter is on-hold
  const isOnHold = patientEncounter?.status === 'on-hold';

  // Filter encounters that are in-progress, on-hold, or planned, and before patient's appointment
  const encountersAhead = encounters.filter(encounter => {
    // Skip the patient's own encounter
    if (patientEncounter && encounter.id === patientEncounter.id) return false;

    // Only count encounters that are actively blocking the queue
    const isActive = encounter.status === 'in-progress' || encounter.status === 'on-hold' || encounter.status === 'planned';
    if (!isActive) return false;

    // Get encounter start time from period
    const encounterStart = encounter.period?.start;
    if (!encounterStart) return false;

    // Count encounters that start before or at the same time as patient's appointment
    return new Date(encounterStart) <= new Date(patientAppointmentStart);
  });

  // Sort by start time (earliest first)
  encountersAhead.sort((a, b) => {
    const aStart = a.period?.start || '';
    const bStart = b.period?.start || '';
    return new Date(aStart).getTime() - new Date(bStart).getTime();
  });

  const count = encountersAhead.length;

  // Queue position is count + 1 (e.g., if 2 ahead, patient is #3)
  const position = count + 1;

  // Check if there's an in-progress encounter ahead
  const hasInProgressAhead = encountersAhead.some(enc => enc.status === 'in-progress');

  // Estimate wait time based on average encounter duration
  // Default to 15 minutes per encounter if no duration data available
  const averageEncounterMinutes = 15;
  const estimatedWaitMinutes = count * averageEncounterMinutes;

  return {
    position,
    encountersAhead: count,
    estimatedWaitMinutes,
    isOnHold,
    hasInProgressAhead,
  };
}

/**
 * Format wait time as human-readable string
 *
 * @param minutes - Wait time in minutes
 * @returns Formatted string like "15-20 minutes" or "1 hour"
 */
export function formatWaitTime(minutes: number): string {
  if (minutes === 0) return 'No wait';

  if (minutes < 60) {
    // Add buffer of ±5 minutes for realism
    const lowerBound = Math.max(0, minutes - 5);
    const upperBound = minutes + 5;
    return `${lowerBound}-${upperBound} minutes`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  }

  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Get queue status message for patient
 *
 * @param position - Queue position (1 = next, 2 = second, etc.)
 * @param isOnHold - Whether patient's encounter is on-hold (starting soon)
 * @param hasInProgressAhead - Whether there's an in-progress encounter ahead
 * @returns Human-readable status message
 */
export function getQueueStatusMessage(
  position: number,
  isOnHold: boolean = false,
  hasInProgressAhead: boolean = false
): string {
  // Special message if patient's encounter is on-hold
  if (isOnHold) {
    return "Your appointment will begin within 10 minutes";
  }

  // If patient is next but there's still an encounter in progress
  if (position === 1 && hasInProgressAhead) {
    return "You're next in the queue (estimated wait: more than 10 minutes)";
  }

  if (position === 1) {
    return "You're currently next in the queue";
  }

  if (position === 2) {
    return "You're second in the queue";
  }

  if (position === 3) {
    return "You're third in the queue";
  }

  return `You're #${position} in the queue`;
}
