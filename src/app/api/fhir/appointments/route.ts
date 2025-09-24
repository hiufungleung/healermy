import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromHeaders, prepareToken } from '../utils/auth';
import { searchAppointments, createAppointment } from './operations';
import { createStatusUpdateMessage } from '../communications/operations';
import type { Appointment } from '../../../../types/fhir';

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
    const options: {
      status?: string;
      _count?: number;
    } = {};
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
    const appointments: Appointment[] = result?.entry?.map((entry) => entry.resource).filter(Boolean) || [];
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
    const appointmentData: Partial<Appointment> = await request.json();
    
    // If patient is creating, ensure status is "pending"
    if (session.role === 'patient') {
      appointmentData.status = 'pending';
      
      // Ensure patient is in participants with status "accepted"
      const patientParticipant = appointmentData.participant?.find((p) =>
        p.actor?.reference?.startsWith('Patient/')
      );
      if (patientParticipant) {
        patientParticipant.status = 'accepted';
      }

      // Ensure practitioner is in participants with status "needs-action"
      const practitionerParticipant = appointmentData.participant?.find((p) =>
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
      console.log(`[APPOINTMENT] Created appointment ${result.id}, attempting to send notification...`);
      try {
        // Extract patient and practitioner references from participants
        const patientParticipant = appointmentData.participant?.find((p) =>
          p.actor?.reference?.startsWith('Patient/')
        );
        const practitionerParticipant = appointmentData.participant?.find((p) =>
          p.actor?.reference?.startsWith('Practitioner/')
        );

        console.log(`[APPOINTMENT] Found participants - Patient: ${patientParticipant?.actor?.reference}, Practitioner: ${practitionerParticipant?.actor?.reference}`);

        if (patientParticipant && practitionerParticipant) {
          // Only send notification when provider creates appointments
          // Patients no longer receive automatic booking confirmation notifications
          if (session.role === 'provider') {
            const statusMessage = 'A new appointment has been scheduled.';
            console.log(`[APPOINTMENT] Creating notification message: "${statusMessage}"`);

            // Create status update message
            const notificationResult = await createStatusUpdateMessage(
              token,
              session.fhirBaseUrl,
              result.id,
              patientParticipant.actor!.reference,
              practitionerParticipant.actor!.reference,
              statusMessage,
              'practitioner'
            );

            console.log(`[APPOINTMENT] Notification created successfully:`, notificationResult.id);
          } else {
            console.log(`[APPOINTMENT] Patient booking - no automatic notification sent`);
          }
        } else {
          console.log(`[APPOINTMENT] Missing participants - cannot send notification`);
        }
      } catch (messageError) {
        // Don't fail the appointment creation if messaging fails
        console.warn('Failed to send appointment notification:', messageError);
      }
    } else {
      console.log(`[APPOINTMENT] No appointment ID returned, cannot send notification`);
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