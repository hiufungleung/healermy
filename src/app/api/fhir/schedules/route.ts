import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies, validateRole, prepareToken } from '../utils/auth';
import { FHIRClient } from '../client';
import { createSchedule } from './operations';

/**
 * GET /api/fhir/schedules - Search schedules
 * Supports batch fetching via _id parameter:
 * - Single ID: ?_id=12345
 * - Multiple IDs: ?_id=12345,67890,11111
 */
export async function GET(request: NextRequest) {
  try {
    // Extract session from middleware headers
    const session = await getSessionFromCookies();

    // Both providers and patients can search schedules
    // Providers: to manage their schedules
    // Patients: to find available slots for booking

    // Pass all query parameters directly to FHIR (preserves duplicate keys)
    const fhirUrl = `${session.fhirBaseUrl}/Schedule?${request.nextUrl.searchParams.toString()}`;
    const token = prepareToken(session.accessToken);

    const response = await FHIRClient.fetchWithAuth(fhirUrl, token);
    const fhirBundle = await response.json();

    // Return the complete FHIR Bundle with all metadata (link, total, entry, etc.)
    // Frontend components will extract what they need from the Bundle structure
    return NextResponse.json(fhirBundle);
  } catch (error) {
    console.error('Error in GET /api/fhir/schedules:', error);
    
    if (error instanceof Error && error.message.includes('session')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to search schedules',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fhir/schedules - Create schedule
 */
export async function POST(request: NextRequest) {
  try {
    // Extract session from middleware headers
    const session = await getSessionFromCookies();
    
    // Validate that user has provider role
    validateRole(session, 'provider');
    
    const scheduleData = await request.json();
    
    // Basic validation
    if (!scheduleData.resourceType || scheduleData.resourceType !== 'Schedule') {
      return NextResponse.json(
        { error: 'Invalid schedule data: resourceType must be "Schedule"' },
        { status: 400 }
      );
    }
    
    const token = prepareToken(session.accessToken);
    const result = await createSchedule(token, session.fhirBaseUrl, scheduleData);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/fhir/schedules:', error);
    
    if (error instanceof Error && error.message.includes('session')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to create schedule',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}