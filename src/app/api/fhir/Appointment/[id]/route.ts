import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies, validateRole, prepareToken } from '@/app/api/fhir/utils/auth';
import { updateAppointment } from '@/app/api/fhir/Appointment/operations';
import { createStatusUpdateMessage } from '@/app/api/fhir/Communication/operations';
import { FHIRClient } from '@/app/api/fhir/client';
import { manageSlotStatusForAppointment } from '@/app/api/fhir/Slot/operations';
import type { Appointment } from '@/types/fhir';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/fhir/Appointment/[id] - Get appointment by ID
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const params = await context.params;
    const { id } = params;

    // Extract session from middleware headers
    const session = await getSessionFromCookies();
    const token = prepareToken(session.accessToken);

    // Get appointment from FHIR
    const response = await FHIRClient.fetchWithAuth(
      `${session.fhirBaseUrl}/Appointment/${id}`,
      token
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Appointment not found' },
        { status: 404 }
      );
    }

    const appointment: Appointment = await response.json();
    return NextResponse.json(appointment);
  } catch (error) {
    let appointmentId = 'unknown';
    try {
      const params = await context.params;
      appointmentId = params.id;
    } catch {
      // Ignore params error in catch block
    }

    console.error(`❌ Error in GET /api/fhir/Appointment/${appointmentId}:`, error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });

    if (error instanceof Error && error.message.includes('session')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      {
        error: 'Failed to get appointment',
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/fhir/Appointment/[id] - Patch appointment using JSON Patch
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params;
  
  try {
    // Extract session from middleware headers
    const session = await getSessionFromCookies();
    
    const token = prepareToken(session.accessToken);
    const patchOperations: Array<{
      op: string;
      path: string;
      value: unknown;
    }> = await request.json();
    
    // Validate patch operations based on user role
    if (session.role === 'patient') {
      // Patients can only cancel their own appointments
      const allowedPatientOperations = ['cancelled'];

      for (const op of patchOperations) {
        if (op.path === '/status' && !allowedPatientOperations.includes(op.value as string)) {
          return NextResponse.json(
            { error: `Patients can only cancel appointments. Status '${op.value}' not allowed.` },
            { status: 403 }
          );
        }
        // Patients can only modify status and reason
        if (!['/status', '/reasonCode'].includes(op.path)) {
          return NextResponse.json(
            { error: `Patients can only modify status or reason. Path '${op.path}' not allowed.` },
            { status: 403 }
          );
        }
      }
    } else if (session.role === 'provider') {
      // Providers can perform any appointment operations
    } else {
      return NextResponse.json(
        { error: 'Invalid user role for appointment updates' },
        { status: 403 }
      );
    }
    
    // Get current appointment to track status change
    const currentAppointmentResponse = await FHIRClient.fetchWithAuth(
      `${session.fhirBaseUrl}/Appointment/${id}`,
      token
    );
    
    let currentAppointment: Appointment | null = null;
    let oldStatus: string | null = null;
    
    if (currentAppointmentResponse.ok) {
      currentAppointment = await currentAppointmentResponse.json() as Appointment;
      oldStatus = currentAppointment.status;
      
      // Additional validation for patients - they can only modify their own appointments
      if (session.role === 'patient') {
        const patientParticipant = currentAppointment.participant?.find((p) =>
          p.actor?.reference?.startsWith('Patient/')
        );
        
        // Extract patient ID from session (assuming it's stored in session.patient)
        const sessionPatientId = session.patient; // e.g., "claim-8d9670e3"
        const appointmentPatientId = patientParticipant?.actor?.reference?.replace('Patient/', '');
        
        if (!patientParticipant || appointmentPatientId !== sessionPatientId) {
          return NextResponse.json(
            { error: 'Patients can only modify their own appointments' },
            { status: 403 }
          );
        }
      }
    } else {
      return NextResponse.json(
        { error: 'Appointment not found' },
        { status: 404 }
      );
    }
    
    // Apply patch operations to FHIR
    const response = await FHIRClient.fetchWithAuth(
      `${session.fhirBaseUrl}/Appointment/${id}`,
      token,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
        body: JSON.stringify(patchOperations),
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: 'Failed to patch appointment', details: errorText },
        { status: response.status }
      );
    }
    
    const result = await response.json();
    
    // Handle slot management based on status changes
    if (currentAppointment) {
      try {
        // Check if status is being changed
        const statusPatch = patchOperations.find((op) => op.path === '/status');

        if (statusPatch) {
          const newStatus = statusPatch.value as string;
          
          // Automatically manage slot status for any status change
          await manageSlotStatusForAppointment(token, session.fhirBaseUrl, currentAppointment, oldStatus, newStatus);
        }
      } catch (slotError) {
        console.warn('Failed to update slot status after appointment patch:', slotError);
        // Don't fail the appointment update if slot update fails
      }
    }

    // Send notification message for status changes
    if (currentAppointment) {
      try {
        const statusPatch = patchOperations.find((op) => op.path === '/status');

        if (statusPatch) {
          const newStatus = statusPatch.value as string;
          const patientParticipant = currentAppointment.participant?.find((p) =>
            p.actor?.reference?.startsWith('Patient/')
          );
          const practitionerParticipant = currentAppointment.participant?.find((p) =>
            p.actor?.reference?.startsWith('Practitioner/')
          );
          
          if (patientParticipant && practitionerParticipant) {
            let statusMessage = '';
            let recipientRole: 'patient' | 'practitioner';

            // Different messages based on who initiated the change
            if (session.role === 'patient') {
              // Patient updates appointment → notify provider
              recipientRole = 'practitioner';
              switch (newStatus) {
                case 'cancelled':
                  statusMessage = 'The patient has cancelled their appointment.';
                  break;
                default:
                  statusMessage = `The patient has updated their appointment status to ${newStatus}.`;
              }
            } else {
              // Provider updates appointment → notify patient
              recipientRole = 'patient';
              switch (newStatus) {
                case 'booked':
                  statusMessage = 'Your appointment request has been approved and confirmed.';
                  break;
                case 'cancelled':
                  statusMessage = 'Your appointment has been cancelled. Please contact us if you have questions.';
                  break;
                case 'arrived':
                  statusMessage = 'Thank you for arriving. Please check in at the front desk.';
                  break;
                case 'checked-in':
                  statusMessage = 'You have been checked in. Please wait to be called.';
                  break;
                case 'fulfilled':
                  statusMessage = 'Your appointment has been completed. Thank you for your visit.';
                  break;
                case 'noshow':
                  statusMessage = 'You were marked as a no-show for your appointment. Please contact us.';
                  break;
                case 'waitlist':
                  statusMessage = 'You have been added to the waitlist. We will notify you if a slot becomes available.';
                  break;
                case 'proposed':
                  statusMessage = 'A new appointment time has been proposed. Please confirm if this works for you.';
                  break;
                case 'entered-in-error':
                  statusMessage = 'This appointment was entered in error and has been removed.';
                  break;
                default:
                  statusMessage = `Your appointment status has been updated to ${newStatus}.`;
              }
            }

            await createStatusUpdateMessage(
              token,
              session.fhirBaseUrl,
              id,
              patientParticipant?.actor?.reference ?? '',
              practitionerParticipant?.actor?.reference ?? '',
              statusMessage,
              recipientRole
            );
          }
        }
      } catch (messageError) {
        console.warn('Failed to send appointment status notification:', messageError);
        // Don't fail the appointment update if messaging fails
      }
    }

    // Note: Encounters are no longer auto-created on approval
    // They are created manually by practitioner when clicking "Start in 10 Minutes"
    // This follows FHIR standards more closely

    return NextResponse.json(result);
  } catch (error) {
    console.error(`Error in PATCH /api/fhir/Appointment/${id}:`, error);
    
    if (error instanceof Error && error.message.includes('session')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to patch appointment',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/fhir/Appointment/[id] - Update appointment
 */
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params;
  
  try {
    // Extract session from middleware headers
    const session = await getSessionFromCookies();
    
    // Check authorization (only providers can update appointments)
    validateRole(session, 'provider');
    
    const token = prepareToken(session.accessToken);
    const updateData = await request.json();
    
    // Get current appointment first
    const currentAppointmentResponse = await FHIRClient.fetchWithAuth(
      `${session.fhirBaseUrl}/Appointment/${id}`,
      token
    );
    
    if (!currentAppointmentResponse.ok) {
      return NextResponse.json(
        { error: 'Appointment not found' },
        { status: 404 }
      );
    }
    
    const appointment: Appointment = await currentAppointmentResponse.json();
    
    // Update appointment status
    const updatedAppointment = {
      ...appointment,
      status: updateData.status
    };
    
    // Update participant statuses if provided
    if (updateData.participantUpdates && updatedAppointment.participant) {
      updateData.participantUpdates.forEach((update: { reference: string; status: string }) => {
        const participant = updatedAppointment.participant!.find((p) =>
          p.actor?.reference === update.reference
        );
        if (participant) {
          participant.status = update.status as 'accepted' | 'declined' | 'tentative' | 'needs-action';
        }
      });
    }
    
    // Update in FHIR with slot management
    const oldStatus = appointment.status;
    const result = await updateAppointment(token, session.fhirBaseUrl, id, updatedAppointment, oldStatus);
    
    // Send status notification
    try {
      const patientParticipant = updatedAppointment.participant?.find((p) =>
        p.actor?.reference?.startsWith('Patient/')
      );
      const practitionerParticipant = updatedAppointment.participant?.find((p) =>
        p.actor?.reference?.startsWith('Practitioner/')
      );
      
      if (patientParticipant && practitionerParticipant) {
        let statusMessage = '';
        
        switch (updateData.status) {
          case 'booked':
            statusMessage = 'Your appointment request has been approved and confirmed.';
            break;
          case 'cancelled':
            statusMessage = 'Your appointment has been cancelled. Please contact us if you have questions.';
            break;
          case 'arrived':
            statusMessage = 'Thank you for arriving. Please check in at the front desk.';
            break;
          case 'checked-in':
            statusMessage = 'You have been checked in. Please wait to be called.';
            break;
          case 'fulfilled':
            statusMessage = 'Your appointment has been completed. Thank you for your visit.';
            break;
          case 'noshow':
            statusMessage = 'You were marked as a no-show for your appointment. Please contact us.';
            break;
          case 'waitlist':
            statusMessage = 'You have been added to the waitlist. We will notify you if a slot becomes available.';
            break;
          case 'proposed':
            statusMessage = 'A new appointment time has been proposed. Please confirm if this works for you.';
            break;
          case 'entered-in-error':
            statusMessage = 'This appointment was entered in error and has been removed.';
            break;
          default:
            statusMessage = `Your appointment status has been updated.`;
        }
        
        await createStatusUpdateMessage(
          token,
          session.fhirBaseUrl,
          id,
          patientParticipant?.actor?.reference ?? '',
          practitionerParticipant?.actor?.reference ?? '',
          statusMessage,
          'practitioner'
        );
      }
    } catch (messageError) {
      // Don't fail the appointment update if messaging fails
      console.warn('Failed to send appointment status notification:', messageError);
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error(`Error in PUT /api/fhir/Appointment/${id}:`, error);
    
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