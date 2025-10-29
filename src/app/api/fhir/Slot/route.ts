import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies, validateRole, prepareToken } from '../utils/auth';
import { searchSlots, createSlot } from './operations';
import { FHIRClient } from '../client';

/**
 * GET /api/fhir/Slot - Search slots
 * Supports batch fetching via _id parameter:
 * - Single ID: ?_id=12345
 * - Multiple IDs: ?_id=12345,67890,11111
 * Also supports all standard FHIR Slot search parameters
 */
export async function GET(request: NextRequest) {
  try {
    // Extract session from middleware headers
    const session = await getSessionFromCookies();

    // Both providers and patients can search for slots
    // Providers: to manage their slots
    // Patients: to book appointments

    // Use the user's own access token for slot queries
    const token = prepareToken(session.accessToken);

    // Build the FHIR URL with all query parameters (including ge/lt prefixes and _id)
    const fhirUrl = `${session.fhirBaseUrl}/Slot?${request.nextUrl.searchParams.toString()}`;

    // Log ALL parameters (including duplicate keys like multiple 'schedule' params)
    const allParams: Record<string, string[]> = {};
    request.nextUrl.searchParams.forEach((value, key) => {
      if (!allParams[key]) allParams[key] = [];
      allParams[key].push(value);
    });

    // Use centralized FHIRClient for consistent error handling and logging
    const response = await FHIRClient.fetchWithAuth(fhirUrl, token);

    const fhirBundle = await response.json();

    // Return the complete FHIR Bundle with all metadata (link, total, entry, etc.)
    // Frontend components will extract what they need from the Bundle structure
    return NextResponse.json(fhirBundle);
  } catch (error) {
    console.error('Error in GET /api/fhir/Slot:', error);
    
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
 * POST /api/fhir/Slot - Create slot (providers only)
 */
export async function POST(request: NextRequest) {
  try {
    // Extract session from middleware headers
    const session = await getSessionFromCookies();
    
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
    console.error('Error in POST /api/fhir/Slot:', error);
    
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