import { FHIRClient } from '../client';
import { createSlot } from '../slots/operations';

export interface SlotInterval {
  start: Date;
  end: Date;
  scheduleId: string;
  practitionerId?: string; // Added to support cross-schedule overlap detection
}

export interface SlotCreationRequest {
  resourceType: 'Slot';
  start: string;
  end: string;
  schedule: { reference: string };
  status: 'free' | 'busy';
  serviceCategory?: Array<{
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
  }>;
  serviceType?: Array<{
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
  }>;
  specialty?: Array<{
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
  }>;
  appointmentType?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
  };
  comment?: string;
}

export interface BatchCreationResult {
  created: any[];
  rejected: Array<{ slot: SlotCreationRequest; reason: string }>;
}

/**
 * Extract schedule ID from FHIR reference
 */
function extractScheduleId(reference: string): string {
  return reference.replace('Schedule/', '');
}

/**
 * Check if two time intervals overlap
 * NOTE: Changed to check practitioner-level overlaps (not schedule-level)
 * A practitioner cannot have overlapping slots across ANY of their schedules
 */
export function detectOverlap(newSlot: SlotInterval, existingSlot: SlotInterval): boolean {
  // Check if intervals overlap: (start1 < end2) && (start2 < end1)
  return (newSlot.start < existingSlot.end) && (existingSlot.start < newSlot.end);
}

/**
 * Check if a slot overlaps with any existing slots
 */
export function hasAnyOverlap(newSlot: SlotInterval, existingSlots: SlotInterval[]): boolean {
  return existingSlots.some(existing => detectOverlap(newSlot, existing));
}

/**
 * Fetch all schedules for a practitioner
 */
async function fetchPractitionerSchedules(
  token: string,
  fhirBaseUrl: string,
  practitionerId: string
): Promise<string[]> {
  const params = new URLSearchParams();
  params.append('actor', `Practitioner/${practitionerId}`);
  params.append('_count', '100');

  const response = await FHIRClient.fetchWithAuth(
    `${fhirBaseUrl}/Schedule?${params.toString()}`,
    token
  );

  const bundle = await response.json();
  const schedules = bundle.entry?.map((entry: any) => entry.resource) || [];

  return schedules.map((schedule: any) => schedule.id);
}

/**
 * Extract practitioner ID from a schedule resource
 */
async function getPractitionerFromSchedule(
  token: string,
  fhirBaseUrl: string,
  scheduleId: string
): Promise<string | null> {
  const response = await FHIRClient.fetchWithAuth(
    `${fhirBaseUrl}/Schedule/${scheduleId}`,
    token
  );

  const schedule = await response.json();
  const practitionerActor = schedule.actor?.find((actor: any) =>
    actor.reference?.startsWith('Practitioner/')
  );

  return practitionerActor ? practitionerActor.reference.replace('Practitioner/', '') : null;
}

/**
 * Fetch all slots in a time range for ALL schedules of a practitioner
 * This ensures overlaps are detected across all schedules, not just within one schedule
 */
export async function fetchSlotsInRangeForPractitioner(
  token: string,
  fhirBaseUrl: string,
  startTime: Date,
  endTime: Date,
  scheduleId: string
): Promise<SlotInterval[]> {
  // Step 1: Get practitioner ID from the schedule
  const practitionerId = await getPractitionerFromSchedule(token, fhirBaseUrl, scheduleId);

  if (!practitionerId) {
    console.warn(`No practitioner found for schedule ${scheduleId}, falling back to schedule-only check`);
    return fetchSlotsForSchedules(token, fhirBaseUrl, startTime, endTime, [scheduleId]);
  }

  // Step 2: Get ALL schedules for this practitioner
  const allScheduleIds = await fetchPractitionerSchedules(token, fhirBaseUrl, practitionerId);
  console.log(`Found ${allScheduleIds.length} schedules for practitioner ${practitionerId}`);

  // Step 3: Fetch all slots for ALL practitioner's schedules
  return fetchSlotsForSchedules(token, fhirBaseUrl, startTime, endTime, allScheduleIds);
}

/**
 * Fetch all slots in a time range for specific schedules
 */
async function fetchSlotsForSchedules(
  token: string,
  fhirBaseUrl: string,
  startTime: Date,
  endTime: Date,
  scheduleIds: string[]
): Promise<SlotInterval[]> {
  const params = new URLSearchParams();

  // Add time range filters using FHIR date search parameters
  params.append('start', `ge${startTime.toISOString()}`);
  params.append('start', `lt${endTime.toISOString()}`);

  // Add schedule filters - FHIR allows multiple values for the same parameter
  scheduleIds.forEach(id => {
    params.append('schedule', `Schedule/${id}`);
  });

  params.append('_count', '1000'); // Large count to get all relevant slots

  const response = await FHIRClient.fetchWithAuth(
    `${fhirBaseUrl}/Slot?${params.toString()}`,
    token
  );

  const bundle = await response.json();
  const slots = bundle.entry?.map((entry: any) => entry.resource) || [];

  return slots.map((slot: any) => ({
    start: new Date(slot.start),
    end: new Date(slot.end),
    scheduleId: extractScheduleId(slot.schedule?.reference || '')
  }));
}

/**
 * Convert SlotCreationRequest to SlotInterval
 */
function toSlotInterval(slot: SlotCreationRequest): SlotInterval {
  return {
    start: new Date(slot.start),
    end: new Date(slot.end),
    scheduleId: extractScheduleId(slot.schedule.reference)
  };
}

/**
 * Create multiple slots with overlap validation
 * Checks for overlaps across ALL practitioner's schedules (not just within one schedule)
 */
export async function createSlotsWithOverlapValidation(
  slotsToCreate: SlotCreationRequest[],
  token: string,
  fhirBaseUrl: string
): Promise<BatchCreationResult> {
  if (slotsToCreate.length === 0) {
    return { created: [], rejected: [] };
  }

  // Step 1: Convert to intervals and determine time range and first schedule
  const intervals = slotsToCreate.map(toSlotInterval);

  const minStart = new Date(Math.min(...intervals.map(i => i.start.getTime())));
  const maxEnd = new Date(Math.max(...intervals.map(i => i.end.getTime())));
  const firstScheduleId = intervals[0].scheduleId; // Use first schedule to get practitioner

  console.log(`Checking ${slotsToCreate.length} slots for overlaps in range ${minStart.toISOString()} to ${maxEnd.toISOString()}`);
  console.log(`Using schedule ${firstScheduleId} to determine practitioner`);

  // Step 2: Fetch existing slots for ALL practitioner's schedules in time range
  const existingSlots = await fetchSlotsInRangeForPractitioner(
    token,
    fhirBaseUrl,
    minStart,
    maxEnd,
    firstScheduleId
  );

  console.log(`Found ${existingSlots.length} existing slots across all practitioner schedules`);

  // Step 3: Validate each slot for overlaps
  const validSlots: SlotCreationRequest[] = [];
  const rejectedSlots: Array<{ slot: SlotCreationRequest; reason: string }> = [];
  
  for (let i = 0; i < slotsToCreate.length; i++) {
    const slot = slotsToCreate[i];
    const interval = intervals[i];
    
    // Check against existing slots (across ALL practitioner schedules)
    if (hasAnyOverlap(interval, existingSlots)) {
      const overlappingSlot = existingSlots.find(existing => detectOverlap(interval, existing));
      const sameSchedule = overlappingSlot?.scheduleId === interval.scheduleId;
      rejectedSlots.push({
        slot,
        reason: `Practitioner has overlapping slot (${overlappingSlot?.start.toISOString()} - ${overlappingSlot?.end.toISOString()}) ${sameSchedule ? 'in same schedule' : `in schedule ${overlappingSlot?.scheduleId}`}`
      });
      continue;
    }

    // Check against other slots being created (avoid creating overlapping slots in same batch)
    const otherNewSlots = intervals.slice(0, i); // Only check against previously validated slots
    if (hasAnyOverlap(interval, otherNewSlots)) {
      const overlappingSlot = otherNewSlots.find(existing => detectOverlap(interval, existing));
      rejectedSlots.push({
        slot, 
        reason: `Overlaps with another slot being created (${overlappingSlot?.start.toISOString()} - ${overlappingSlot?.end.toISOString()})` 
      });
      continue;
    }
    
    validSlots.push(slot);
  }
  
  console.log(`Validation complete: ${validSlots.length} valid, ${rejectedSlots.length} rejected`);

  // Step 4: Batch create all valid slots using Promise.allSettled
  const creationPromises = validSlots.map(slot => 
    createSlot(token, fhirBaseUrl, slot)
      .catch(error => {
        // Convert errors to a rejected format for consistent handling
        throw new Error(`Creation failed: ${error.message || String(error)}`);
      })
  );
  
  const results = await Promise.allSettled(creationPromises);
  const created: any[] = [];
  
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      created.push(result.value);
    } else {
      rejectedSlots.push({
        slot: validSlots[index],
        reason: result.reason instanceof Error ? result.reason.message : String(result.reason)
      });
    }
  });
  
  console.log(`Creation complete: ${created.length} created, ${rejectedSlots.length} total rejected`);

  return { created, rejected: rejectedSlots };
}