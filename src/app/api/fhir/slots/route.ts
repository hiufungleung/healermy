import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies, validateRole, prepareToken } from '../utils/auth';
import { searchSlots, createSlot } from './operations';
import { FHIRClient } from '../client';

/**
 * GET /api/fhir/slots - Search slots
 */
export async function GET(request: NextRequest) {
  try {
    console.log('=== SLOTS API ROUTE - START ===');
    console.log('Request URL:', request.url);
    console.log('Request headers:', Object.fromEntries(request.headers.entries()));

    // Extract session from middleware headers
    const session = await getSessionFromCookies();

    console.log('Slots API - Session role:', session.role);
    console.log('Slots API - Session scopes:', session.scope);
    console.log('Slots API - FHIR Base URL:', session.fhirBaseUrl);
    console.log('Slots API - Access Token (first 20 chars):', session.accessToken.substring(0, 20) + '...');

    // Both providers and patients can search for slots
    // Providers: to manage their slots
    // Patients: to book appointments

    // Use the user's own access token for slot queries
    const token = prepareToken(session.accessToken);

    console.log('Slots API - Using session access token for role:', session.role);

    // Build the FHIR URL with all query parameters (including ge/lt prefixes)
    const fhirUrl = `${session.fhirBaseUrl}/Slot?${request.nextUrl.searchParams.toString()}`;

    console.log('Slots API - FHIR URL:', fhirUrl);
    console.log('Slots API - Query params:', Object.fromEntries(request.nextUrl.searchParams.entries()));

    // Use centralized FHIRClient for consistent error handling and logging
    console.log('=== MAKING FHIR REQUEST ===');
    const response = await FHIRClient.fetchWithAuth(fhirUrl, token);

    console.log('Slots API - FHIR response status:', response.status);
    console.log('Slots API - FHIR response headers:', Object.fromEntries(response.headers.entries()));

    const fhirBundle = await response.json();
    console.log('Slots API - FHIR response total:', fhirBundle.total);
    console.log('Slots API - FHIR response entry count:', fhirBundle.entry?.length || 0);
    if (fhirBundle.entry && fhirBundle.entry.length > 0) {
      console.log('Slots API - First 3 slot IDs:', fhirBundle.entry.slice(0, 3).map((e: any) => e.resource?.id));
    }
    console.log('Slots API - FHIR response bundle:', JSON.stringify(fhirBundle, null, 2));
    
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