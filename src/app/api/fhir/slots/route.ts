import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromHeaders, validateRole, prepareToken } from '../utils/auth';
import { searchSlots, createSlot } from './operations';
import { FHIRClient } from '../client';

/**
 * GET /api/fhir/slots - Search slots
 */
export async function GET(request: NextRequest) {
  try {
    // Extract session from middleware headers
    const session = await getSessionFromHeaders();
    
    // Both providers and patients can search for slots
    // Providers: to manage their slots
    // Patients: to book appointments
    
    // Pass through all query parameters directly to FHIR
    // This handles multiple parameters with the same name (like multiple 'start' params)
    const token = prepareToken(session.accessToken);
    
    // Build the FHIR URL with all query parameters (including ge/lt prefixes)
    const fhirUrl = `${session.fhirBaseUrl}/Slot?${request.nextUrl.searchParams.toString()}`;
    
    // Use centralized FHIRClient for consistent error handling and logging
    const response = await FHIRClient.fetchWithAuth(fhirUrl, token);

    const fhirBundle = await response.json();
    
    // Transform FHIR Bundle to expected format
    const slots = fhirBundle.entry?.map((entry: any) => entry.resource) || [];
    const nextUrl = fhirBundle.link?.find((link: any) => link.relation === 'next')?.url;
    
    const result = {
      slots,
      total: fhirBundle.total || slots.length,
      nextUrl: nextUrl || null
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in GET /api/fhir/slots:', error);
    
    if (error instanceof Error && error.message.includes('session')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to search slots',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fhir/slots - Create slot (providers only)
 */
export async function POST(request: NextRequest) {
  try {
    // Extract session from middleware headers
    const session = await getSessionFromHeaders();
    
    // Only providers can create slots
    validateRole(session, 'provider');
    
    const slotData = await request.json();
    
    // Basic validation
    if (!slotData.resourceType || slotData.resourceType !== 'Slot') {
      return NextResponse.json(
        { error: 'Invalid slot data: resourceType must be "Slot"' },
        { status: 400 }
      );
    }
    
    if (!slotData.start || !slotData.end) {
      return NextResponse.json(
        { error: 'Invalid slot data: start and end times are required' },
        { status: 400 }
      );
    }
    
    if (!slotData.status) {
      // Default to 'free' status
      slotData.status = 'free';
    }
    
    // Validate status is only 'free' or 'busy'
    if (slotData.status !== 'free' && slotData.status !== 'busy') {
      return NextResponse.json(
        { error: 'Invalid slot status: must be "free" or "busy"' },
        { status: 400 }
      );
    }
    
    const token = prepareToken(session.accessToken);
    const result = await createSlot(token, session.fhirBaseUrl, slotData);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/fhir/slots:', error);
    
    if (error instanceof Error && error.message.includes('session')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to create slot',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}