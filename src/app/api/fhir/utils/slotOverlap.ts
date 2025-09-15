import { FHIRClient } from '../client';
import { createSlot } from '../slots/operations';

export interface SlotInterval {
  start: Date;
  end: Date;
  scheduleId: string;
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
 */
export function detectOverlap(newSlot: SlotInterval, existingSlot: SlotInterval): boolean {
  // Same schedule and time overlap
  if (newSlot.scheduleId !== existingSlot.scheduleId) return false;
  
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
 * Fetch all slots in a time range for specific schedules
 */
export async function fetchSlotsInRange(
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
 */
export async function createSlotsWithOverlapValidation(
  slotsToCreate: SlotCreationRequest[],
  token: string,
  fhirBaseUrl: string
): Promise<BatchCreationResult> {
  if (slotsToCreate.length === 0) {
    return { created: [], rejected: [] };
  }

  // Step 1: Convert to intervals and determine time range and schedules
  const intervals = slotsToCreate.map(toSlotInterval);
  
  const minStart = new Date(Math.min(...intervals.map(i => i.start.getTime())));
  const maxEnd = new Date(Math.max(...intervals.map(i => i.end.getTime())));
  const scheduleIds = [...new Set(intervals.map(i => i.scheduleId))];
  
  console.log(`Checking ${slotsToCreate.length} slots for overlaps in range ${minStart.toISOString()} to ${maxEnd.toISOString()}`);
  console.log(`Schedules involved: ${scheduleIds.join(', ')}`);

  // Step 2: Batch fetch existing slots in time range
  const existingSlots = await fetchSlotsInRange(
    token, 
    fhirBaseUrl, 
    minStart, 
    maxEnd, 
    scheduleIds
  );
  
  console.log(`Found ${existingSlots.length} existing slots in range`);

  // Step 3: Validate each slot for overlaps
  const validSlots: SlotCreationRequest[] = [];
  const rejectedSlots: Array<{ slot: SlotCreationRequest; reason: string }> = [];
  
  for (let i = 0; i < slotsToCreate.length; i++) {
    const slot = slotsToCreate[i];
    const interval = intervals[i];
    
    // Check against existing slots
    if (hasAnyOverlap(interval, existingSlots)) {
      const overlappingSlot = existingSlots.find(existing => detectOverlap(interval, existing));
      rejectedSlots.push({ 
        slot, 
        reason: `Overlaps with existing slot (${overlappingSlot?.start.toISOString()} - ${overlappingSlot?.end.toISOString()}) in schedule ${interval.scheduleId}` 
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