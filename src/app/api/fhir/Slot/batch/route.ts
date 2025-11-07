import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies, validateRole, prepareToken } from '../../utils/auth';
import { createSlotsWithOverlapValidation, SlotCreationRequest } from '../../utils/slotOverlap';
import { isFutureTime } from '@/lib/timezone';

/**
 * POST /api/fhir/Slot/batch - Create multiple slots with overlap validation (providers only)
 */
export async function POST(request: NextRequest) {
  try {
    // Extract session from middleware headers
    const session = await getSessionFromCookies();
    
    // Only providers can create slots
    validateRole(session, 'provider');
    
    const { slots } = await request.json();
    
    // Validate input
    if (!Array.isArray(slots) || slots.length === 0) {
      return NextResponse.json(
        { error: 'Invalid input: slots must be a non-empty array' },
        { status: 400 }
      );
    }
    
    // Validate each slot in the array
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      
      // Basic validation
      if (!slot.resourceType || slot.resourceType !== 'Slot') {
        return NextResponse.json(
          { error: `Invalid slot data at index ${i}: resourceType must be "Slot"` },
          { status: 400 }
        );
      }
      
      if (!slot.start || !slot.end) {
        return NextResponse.json(
          { error: `Invalid slot data at index ${i}: start and end times are required` },
          { status: 400 }
        );
      }
      
      if (!slot.schedule?.reference) {
        return NextResponse.json(
          { error: `Invalid slot data at index ${i}: schedule reference is required` },
          { status: 400 }
        );
      }
      
      // Set default status if not provided
      if (!slot.status) {
        slot.status = 'free';
      }
      
      // Validate status is only 'free' or 'busy'
      if (slot.status !== 'free' && slot.status !== 'busy') {
        return NextResponse.json(
          { error: `Invalid slot status at index ${i}: must be "free" or "busy"` },
          { status: 400 }
        );
      }
      
      // Validate time order
      const startTime = new Date(slot.start);
      const endTime = new Date(slot.end);
      
      if (startTime >= endTime) {
        return NextResponse.json(
          { error: `Invalid slot data at index ${i}: start time must be before end time` },
          { status: 400 }
        );
      }
      
      // Validate time is in the future using local timezone
      if (!isFutureTime(slot.start)) {
        return NextResponse.json(
          { error: `Invalid slot data at index ${i}: start time must be in the future (local timezone)` },
          { status: 400 }
        );
      }
    }
    
    const token = prepareToken(session.accessToken);
    
    // Use overlap validation and batch creation
    const result = await createSlotsWithOverlapValidation(
      slots as SlotCreationRequest[],
      token,
      session.fhirBaseUrl
    );
    
    // Return comprehensive results
    return NextResponse.json({
      success: result.created.length > 0,
      total: slots.length,
      created: result.created.length,
      rejected: result.rejected.length,
      results: {
        created: result.created,
        rejected: result.rejected
      }
    }, { 
      status: result.created.length > 0 ? 201 : 400 
    });
    
  } catch (error) {
    console.error('Error in POST /api/fhir/Slot/batch:', error);
    
    if (error instanceof Error && error.message.includes('session')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to create slots',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}