/**
 * Schedule overlap validation utilities
 * Prevents creating conflicting schedules for the same practitioner
 */

import type { Schedule } from '@/types/fhir';

/**
 * Check if two date ranges overlap
 * Returns true if ranges overlap, false otherwise
 */
export function dateRangesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const s1 = new Date(start1);
  const e1 = new Date(end1);
  const s2 = new Date(start2);
  const e2 = new Date(end2);

  // Two ranges overlap if: start1 < end2 AND start2 < end1
  return s1 < e2 && s2 < e1;
}

/**
 * Extract coding value from FHIR CodeableConcept
 */
function extractCoding(codeableConcept: any[] | undefined): string | null {
  if (!codeableConcept || codeableConcept.length === 0) {
    return null;
  }

  const firstConcept = codeableConcept[0];
  if (firstConcept.coding && firstConcept.coding.length > 0) {
    return firstConcept.coding[0].code || null;
  }

  return null;
}

/**
 * Check if a new schedule conflicts with existing schedules
 *
 * A conflict occurs when:
 * 1. Same practitioner
 * 2. Same specialty
 * 3. Same service category
 * 4. Same service type
 * 5. Date ranges overlap
 *
 * @param newSchedule - The schedule being created
 * @param existingSchedules - All existing schedules for the practitioner
 * @param practitionerId - The practitioner ID
 * @returns Object with conflict status and details
 */
export function checkScheduleConflict(
  newSchedule: {
    specialty: string;
    serviceCategory: string;
    serviceType: string;
    planningHorizonStart: string;
    planningHorizonEnd: string;
  },
  existingSchedules: Schedule[],
  practitionerId: string
): {
  hasConflict: boolean;
  conflictingSchedule?: Schedule;
  message?: string;
} {
  // Filter schedules for this practitioner
  const practitionerSchedules = existingSchedules.filter(schedule => {
    const actorRef = schedule.actor?.find(a => a.reference?.includes('Practitioner/'));
    return actorRef?.reference === `Practitioner/${practitionerId}`;
  });

  // Check each existing schedule for conflicts
  for (const existingSchedule of practitionerSchedules) {
    // Extract codes from existing schedule
    const existingSpecialty = extractCoding(existingSchedule.specialty);
    const existingCategory = extractCoding(existingSchedule.serviceCategory);
    const existingType = extractCoding(existingSchedule.serviceType);

    // Check if specialty, category, and type match
    const specialtyMatches = existingSpecialty === newSchedule.specialty;
    const categoryMatches = existingCategory === newSchedule.serviceCategory;
    const typeMatches = existingType === newSchedule.serviceType;

    if (specialtyMatches && categoryMatches && typeMatches) {
      // Same specialty/category/type - check date overlap
      if (existingSchedule.planningHorizon?.start && existingSchedule.planningHorizon?.end) {
        const hasOverlap = dateRangesOverlap(
          newSchedule.planningHorizonStart,
          newSchedule.planningHorizonEnd,
          existingSchedule.planningHorizon.start,
          existingSchedule.planningHorizon.end
        );

        if (hasOverlap) {
          // Format dates for message
          const existingStart = new Date(existingSchedule.planningHorizon.start).toLocaleDateString();
          const existingEnd = new Date(existingSchedule.planningHorizon.end).toLocaleDateString();

          return {
            hasConflict: true,
            conflictingSchedule: existingSchedule,
            message: `A schedule with the same specialty, service category, and service type already exists for this date range (${existingStart} - ${existingEnd}). Please use a different date range or modify the existing schedule.`
          };
        }
      }
    }
  }

  // No conflicts found
  return {
    hasConflict: false
  };
}

/**
 * Format schedule details for display
 */
export function formatScheduleDetails(schedule: Schedule): string {
  const specialty = extractCoding(schedule.specialty);
  const category = extractCoding(schedule.serviceCategory);
  const type = extractCoding(schedule.serviceType);
  const start = schedule.planningHorizon?.start
    ? new Date(schedule.planningHorizon.start).toLocaleDateString()
    : 'N/A';
  const end = schedule.planningHorizon?.end
    ? new Date(schedule.planningHorizon.end).toLocaleDateString()
    : 'N/A';

  return `Specialty: ${specialty || 'N/A'}, Category: ${category || 'N/A'}, Type: ${type || 'N/A'}, Period: ${start} - ${end}`;
}
