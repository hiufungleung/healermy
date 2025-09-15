import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromHeaders, validateRole, prepareToken } from '../../utils/auth';
import { updateAppointment } from '../operations';

/**
 * PUT /api/fhir/appointments/[id] - Update appointment
 */
export async function PUT(
  request: NextRequest, 
  { params }: { params: { id: string } }
) {
  try {
    // Extract session from middleware headers
    const session = await getSessionFromHeaders();
    
    // Check authorization (only providers can update appointments)
    validateRole(session, 'provider');
    
    // Parse request body
    const appointmentData = await request.json();

    // Call FHIR operations
    const token = prepareToken(session.accessToken);
    const result = await updateAppointment(
      token,
      session.fhirBaseUrl,
      params.id,
      appointmentData
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error(`Error in PUT /api/fhir/appointments/${params?.id}:`, error);
    
    // Handle specific error types
    if (error instanceof Error && error.message.includes('session')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    
    // Check if it's a 404 from FHIR
    if (error instanceof Error && error.message.includes('404')) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to update appointment',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}