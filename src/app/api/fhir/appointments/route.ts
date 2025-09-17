import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromHeaders, validateRole, prepareToken } from '../utils/auth';
import { searchAppointments, createAppointment } from './operations';
import { createStatusUpdateMessage } from '../communications/operations';

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
    const date = searchParams.get('date'); // For single date queries like ?date=2025-01-15

    // Call FHIR operations
    const token = prepareToken(session.accessToken);
    const _count = searchParams.get('_count');
    
    // Build options object
    const options: any = {};
    if (status) options.status = status;
    if (_count) options._count = parseInt(_count);
    
    // Handle single date vs date range
    let finalDateFrom = dateFrom;
    let finalDateTo = dateTo;
    
    if (date && !dateFrom && !dateTo) {
      // Single date query (like ?date=2025-01-15) - search for that day only
      finalDateFrom = date;
      finalDateTo = date;
    }
    
    const result = await searchAppointments(
      token,
      session.fhirBaseUrl,
      patientId || undefined,
      practitionerId || undefined,
      Object.keys(options).length > 0 ? options : undefined,
      finalDateFrom || undefined,
      finalDateTo || undefined
    );

    // Extract appointments from FHIR Bundle structure
    const appointments = result?.entry?.map((entry: any) => entry.resource).filter(Boolean) || [];
    return NextResponse.json({ appointments });
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
    
    // Both patients and providers can create appointments
    // Patients create with status "pending", providers can create "booked"
    
    // Parse request body
    const appointmentData = await request.json();
    
    // If patient is creating, ensure status is "pending"
    if (session.role === 'patient') {
      appointmentData.status = 'pending';
      
      // Ensure patient is in participants with status "accepted"
      const patientParticipant = appointmentData.participant?.find((p: any) => 
        p.actor?.reference?.startsWith('Patient/')
      );
      if (patientParticipant) {
        patientParticipant.status = 'accepted';
      }
      
      // Ensure practitioner is in participants with status "needs-action"
      const practitionerParticipant = appointmentData.participant?.find((p: any) => 
        p.actor?.reference?.startsWith('Practitioner/')
      );
      if (practitionerParticipant) {
        practitionerParticipant.status = 'needs-action';
      }
    }

    // Call FHIR operations
    const token = prepareToken(session.accessToken);
    const result = await createAppointment(token, session.fhirBaseUrl, appointmentData);

    // Send notification message after successful creation
    if (result.id) {
      try {
        // Extract patient and practitioner references from participants
        const patientParticipant = appointmentData.participant?.find((p: any) => 
          p.actor?.reference?.startsWith('Patient/')
        );
        const practitionerParticipant = appointmentData.participant?.find((p: any) => 
          p.actor?.reference?.startsWith('Practitioner/')
        );
        
        if (patientParticipant && practitionerParticipant) {
          let statusMessage = '';
          
          if (session.role === 'patient') {
            statusMessage = 'Your appointment request has been submitted and is pending approval from the provider.';
          } else {
            statusMessage = 'A new appointment has been scheduled.';
          }
          
          // Create status update message
          await createStatusUpdateMessage(
            token,
            session.fhirBaseUrl,
            result.id,
            patientParticipant.actor.reference,
            practitionerParticipant.actor.reference,
            statusMessage,
            session.role === 'patient' ? 'system' : 'practitioner'
          );
        }
      } catch (messageError) {
        // Don't fail the appointment creation if messaging fails
        console.warn('Failed to send appointment notification:', messageError);
      }
    }

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