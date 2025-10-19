import type { Encounter, Appointment } from '@/types/fhir';

/**
 * CENTRALIZED CONSTANTS
 */
export const ENCOUNTER_PLANNED_WAIT_TIME_MINUTES = 10; // Time shown when encounter status is 'planned'
export const AVERAGE_ENCOUNTER_MINUTES = 30; // Fallback duration when actual appointment duration not available

/**
 * Calculate queue position for a patient based on encounters before their appointment
 * Now uses actual appointment durations for more accurate wait time estimation
 *
 * @param patientAppointmentStart - ISO date string of patient's appointment start time
 * @param encounters - List of all encounters for the practitioner/location
 * @param appointments - List of appointments corresponding to encounters (for duration calculation)
 * @param patientEncounter - Optional: Patient's own encounter to check status
 * @returns Object with queue position, estimated wait time, and special status flags
 */
export function calculateQueuePosition(
  patientAppointmentStart: string,
  encounters: Encounter[],
  appointments?: Appointment[],
  patientEncounter?: Encounter
): {
  position: number;
  encountersAhead: number;
  estimatedWaitMinutes: number;
  isOnHold: boolean;
  isPlanned: boolean;
  hasInProgressAhead: boolean;
} {
  // Check if patient's own encounter is on-hold or planned
  const isOnHold = patientEncounter?.status === 'on-hold';
  const isPlanned = patientEncounter?.status === 'planned';

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

  // Calculate wait time using actual appointment durations if available
  let totalWaitMinutes = 0;
  const averageEncounterMinutes = 15; // Fallback default

  encountersAhead.forEach(encounter => {
    // Try to find corresponding appointment for duration
    if (appointments && encounter.appointment?.[0]) {
      const appointmentRef = encounter.appointment[0].reference;
      const appointmentId = appointmentRef?.replace('Appointment/', '');

      const appointment = appointments.find(apt => apt.id === appointmentId);

      if (appointment && appointment.start && appointment.end) {
        // Use actual appointment duration
        const duration = (new Date(appointment.end).getTime() - new Date(appointment.start).getTime()) / (1000 * 60);
        totalWaitMinutes += duration;
      } else {
        // Fallback to average
        totalWaitMinutes += averageEncounterMinutes;
      }
    } else {
      // No appointments provided, use average
      totalWaitMinutes += averageEncounterMinutes;
    }
  });

  // If patient has planned encounter, wait time is < 10 minutes
  const estimatedWaitMinutes = isPlanned ? 10 : Math.round(totalWaitMinutes);

  return {
    position,
    encountersAhead: count,
    estimatedWaitMinutes,
    isOnHold,
    isPlanned,
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
 * @param isPlanned - Whether patient's encounter is planned (< 10 min wait)
 * @param hasInProgressAhead - Whether there's an in-progress encounter ahead
 * @returns Human-readable status message
 */
export function getQueueStatusMessage(
  position: number,
  isOnHold: boolean = false,
  isPlanned: boolean = false,
  hasInProgressAhead: boolean = false
): string {
  // Special message if patient's encounter is on-hold
  if (isOnHold) {
    return "Your appointment will begin within 10 minutes";
  }

  // Special message if patient's encounter is planned (created by "Will be finished in 10 min")
  if (isPlanned) {
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
