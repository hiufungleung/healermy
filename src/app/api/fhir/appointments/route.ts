import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromHeaders, validateRole, prepareToken } from '../utils/auth';
import { searchAppointments, createAppointment } from './operations';

/**
 * GET /api/fhir/appointments - Search appointments
 */
export async function GET(request: NextRequest) {
  try {
    // Extract session from middleware headers
    const session = await getSessionFromHeaders();
    
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patient');
    const practitionerId = searchParams.get('practitioner');
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('date-from');
    const dateTo = searchParams.get('date-to');

    // Call FHIR operations
    const token = prepareToken(session.accessToken);
    const result = await searchAppointments(
      token,
      session.fhirBaseUrl,
      patientId || undefined,
      practitionerId || undefined,
      status || undefined,
      dateFrom || undefined,
      dateTo || undefined
    );

    return NextResponse.json({ appointments: result });
  } catch (error) {
    console.error('Error in GET /api/fhir/appointments:', error);
    
    // Handle specific error types
    if (error instanceof Error && error.message.includes('session')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to search appointments',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fhir/appointments - Create appointment
 */
export async function POST(request: NextRequest) {
  try {
    // Extract session from middleware headers
    const session = await getSessionFromHeaders();
    
    // Check authorization (only providers can create appointments)
    validateRole(session, 'provider');
    
    // Parse request body
    const appointmentData = await request.json();

    // Call FHIR operations
    const token = prepareToken(session.accessToken);
    const result = await createAppointment(token, session.fhirBaseUrl, appointmentData);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/fhir/appointments:', error);
    
    // Handle specific error types
    if (error instanceof Error && error.message.includes('session')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to create appointment',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}