import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromHeaders, validateRole, prepareToken } from '../utils/auth';
import { searchSchedules, createSchedule } from './operations';

/**
 * GET /api/fhir/schedules - Search schedules
 */
export async function GET(request: NextRequest) {
  try {
    // Extract session from middleware headers
    const session = await getSessionFromHeaders();
    
    // Both providers and patients can search schedules
    // Providers: to manage their schedules  
    // Patients: to find available slots for booking
    
    const { searchParams } = request.nextUrl;
    
    // Build search options from query parameters - Direct FHIR mapping
    const searchOptions: {
      actor?: string;
      date?: string;
      specialty?: string;
      _count?: number;
    } = {};

    if (searchParams.get('actor')) {
      searchOptions.actor = searchParams.get('actor')!;
    }
    if (searchParams.get('date')) {
      searchOptions.date = searchParams.get('date')!;
    }
    if (searchParams.get('specialty')) {
      searchOptions.specialty = searchParams.get('specialty')!;
    }
    if (searchParams.get('_count')) {
      searchOptions._count = parseInt(searchParams.get('_count')!);
    }

    const token = prepareToken(session.accessToken);
    const fhirBundle = await searchSchedules(token, session.fhirBaseUrl, searchOptions);
    
    // Transform FHIR Bundle to expected format
    const schedules = fhirBundle.entry?.map((entry: any) => entry.resource) || [];
    const nextUrl = fhirBundle.link?.find((link: any) => link.relation === 'next')?.url;
    
    const result = {
      schedules,
      total: fhirBundle.total || schedules.length,
      nextUrl: nextUrl || null
    };

    return NextResponse.json(result);
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
    const session = await getSessionFromHeaders();
    
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