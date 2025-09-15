import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromHeaders, validateRole, prepareToken } from '../../utils/auth';
import { getSlot, updateSlot, patchSlot, deleteSlot } from '../operations';

/**
 * GET /api/fhir/slots/[id] - Get slot by ID
 */
export async function GET(
  request: NextRequest, 
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Extract session from middleware headers
    const session = await getSessionFromHeaders();
    
    // Both providers and patients can view individual slots
    
    const { id } = await params;
    const token = prepareToken(session.accessToken);
    const result = await getSlot(token, session.fhirBaseUrl, id);

    return NextResponse.json(result);
  } catch (error) {
    const { id } = await params;
    console.error(`Error in GET /api/fhir/slots/${id}:`, error);
    
    if (error instanceof Error && error.message.includes('session')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    if (error instanceof Error && error.message.includes('404')) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to get slot',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/fhir/slots/[id] - Update slot by ID (providers only)
 */
export async function PUT(
  request: NextRequest, 
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Extract session from middleware headers
    const session = await getSessionFromHeaders();
    
    // Only providers can update slots
    validateRole(session, 'provider');
    
    const { id } = await params;
    const slotData = await request.json();
    
    // Basic validation
    if (!slotData.resourceType || slotData.resourceType !== 'Slot') {
      return NextResponse.json(
        { error: 'Invalid slot data: resourceType must be "Slot"' },
        { status: 400 }
      );
    }
    
    // Ensure the ID in the data matches the URL parameter
    slotData.id = id;
    
    const token = prepareToken(session.accessToken);
    const result = await updateSlot(token, session.fhirBaseUrl, id, slotData);

    return NextResponse.json(result);
  } catch (error) {
    const { id } = await params;
    console.error(`Error in PUT /api/fhir/slots/${id}:`, error);
    
    if (error instanceof Error && error.message.includes('session')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    if (error instanceof Error && error.message.includes('404')) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to update slot',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/fhir/slots/[id] - Partial update slot (providers only)
 * Typically used for status changes (free -> busy when booked)
 */
export async function PATCH(
  request: NextRequest, 
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Extract session from middleware headers
    const session = await getSessionFromHeaders();
    
    // Only providers can patch slots
    validateRole(session, 'provider');
    
    const { id } = await params;
    const patchData = await request.json();
    
    const token = prepareToken(session.accessToken);
    const result = await patchSlot(token, session.fhirBaseUrl, id, patchData);

    return NextResponse.json(result);
  } catch (error) {
    const { id } = await params;
    console.error(`Error in PATCH /api/fhir/slots/${id}:`, error);
    
    if (error instanceof Error && error.message.includes('session')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    if (error instanceof Error && error.message.includes('404')) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to patch slot',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/fhir/slots/[id] - Delete slot by ID (providers only)
 */
export async function DELETE(
  request: NextRequest, 
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Extract session from middleware headers
    const session = await getSessionFromHeaders();
    
    // Only providers can delete slots
    validateRole(session, 'provider');
    
    const { id } = await params;
    const token = prepareToken(session.accessToken);
    const result = await deleteSlot(token, session.fhirBaseUrl, id);

    return NextResponse.json(result);
  } catch (error) {
    const { id } = await params;
    console.error(`Error in DELETE /api/fhir/slots/${id}:`, error);
    
    if (error instanceof Error && error.message.includes('session')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    if (error instanceof Error && error.message.includes('404')) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to delete slot',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}