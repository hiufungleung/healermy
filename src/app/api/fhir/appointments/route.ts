import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies, prepareToken } from '@/app/api/fhir/utils/auth';
import { searchAppointments, createAppointment } from '@/app/api/fhir/appointments/operations';
import { createStatusUpdateMessage } from '@/app/api/fhir/communications/operations';
import type { Appointment } from '@/types/fhir';

/**
 * GET /api/fhir/appointments - Search appointments
 * Supports batch fetching via _id parameter:
 * - Single ID: ?_id=131249
 * - Multiple IDs: ?_id=131249,131305,131261
 */
export async function GET(request: NextRequest) {
  try {
    // Extract session from middleware headers
    const session = await getSessionFromCookies();

    // Get ALL query parameters as-is (don't parse individually)
    const searchParams = request.nextUrl.searchParams;

    // Convert URLSearchParams to plain object, passing ALL parameters to FHIR API
    const allParams: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      allParams[key] = value;
    });

    // Auto-filter by patient based on session role (security enforcement)
    // Patients can only see their own appointments
    if (session.role === 'patient' && !allParams.patient) {
      allParams.patient = session.patient || '';
    }

    // Call FHIR API with ALL query parameters
    // This passes through _sort, start, _count, status, date, _id, and any other params
    const token = prepareToken(session.accessToken);

    const result = await searchAppointments(
      token,
      session.fhirBaseUrl,
      allParams.patient,
      allParams.practitioner,
      allParams, // Pass ALL params as options
      undefined, // Let options handle date params
      undefined
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
    const session = await getSessionFromCookies();
    
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
          // Send notification based on who created the appointment
          if (session.role === 'patient') {
            // Patient creates appointment → notify provider ONLY (don't notify patient)
            const statusMessage = `New appointment request from ${patientParticipant.actor!.display || 'patient'} - pending approval.`;
            console.log(`[APPOINTMENT] Creating notification message for provider: "${statusMessage}"`);

            // Create status update message for provider
            const notificationResult = await createStatusUpdateMessage(
              token,
              session.fhirBaseUrl,
              result.id,
              patientParticipant.actor!.reference,
              practitionerParticipant.actor!.reference,
              statusMessage,
              'practitioner'
            );

            console.log(`[APPOINTMENT] Provider notification created successfully:`, notificationResult.id);
          }
          // Note: Provider creating appointments don't send automatic notifications
          // Notifications are sent when appointment status changes (approve/reject)
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