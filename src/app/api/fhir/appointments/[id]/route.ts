import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromHeaders, validateRole, prepareToken } from '../../utils/auth';
import { updateAppointment } from '../operations';
import { createStatusUpdateMessage } from '../../communications/operations';
import { FHIRClient } from '../../client';
import { manageSlotStatusForAppointment } from '../../slots/operations';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/fhir/appointments/[id] - Get appointment by ID
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params;
  
  try {
    // Extract session from middleware headers
    const session = await getSessionFromHeaders();
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
    
    const appointment = await response.json();
    return NextResponse.json(appointment);
  } catch (error) {
    console.error(`Error in GET /api/fhir/appointments/${id}:`, error);
    
    if (error instanceof Error && error.message.includes('session')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to get appointment',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/fhir/appointments/[id] - Patch appointment using JSON Patch
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params;
  
  try {
    // Extract session from middleware headers
    const session = await getSessionFromHeaders();
    
    // Check authorization (only providers can update appointments)
    validateRole(session, 'provider');
    
    const token = prepareToken(session.accessToken);
    const patchOperations = await request.json();
    
    // Get current appointment to track status change
    const currentAppointmentResponse = await FHIRClient.fetchWithAuth(
      `${session.fhirBaseUrl}/Appointment/${id}`,
      token
    );
    
    let currentAppointment = null;
    let oldStatus = null;
    
    if (currentAppointmentResponse.ok) {
      currentAppointment = await currentAppointmentResponse.json();
      oldStatus = currentAppointment.status;
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
        const statusPatch = patchOperations.find((op: any) => op.path === '/status');
        
        if (statusPatch) {
          const newStatus = statusPatch.value;
          
          // Automatically manage slot status for any status change
          await manageSlotStatusForAppointment(token, session.fhirBaseUrl, currentAppointment, oldStatus, newStatus);
        }
      } catch (slotError) {
        console.warn('Failed to update slot status after appointment patch:', slotError);
        // Don't fail the appointment update if slot update fails
      }
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error(`Error in PATCH /api/fhir/appointments/${id}:`, error);
    
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
 * PUT /api/fhir/appointments/[id] - Update appointment
 */
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params;
  
  try {
    // Extract session from middleware headers
    const session = await getSessionFromHeaders();
    
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
    
    const appointment = await currentAppointmentResponse.json();
    
    // Update appointment status
    const updatedAppointment = {
      ...appointment,
      status: updateData.status
    };
    
    // Update participant statuses if provided
    if (updateData.participantUpdates) {
      updateData.participantUpdates.forEach((update: any) => {
        const participant = updatedAppointment.participant.find((p: any) => 
          p.actor.reference === update.reference
        );
        if (participant) {
          participant.status = update.status;
        }
      });
    }
    
    // Update in FHIR with slot management
    const oldStatus = appointment.status;
    const result = await updateAppointment(token, session.fhirBaseUrl, id, updatedAppointment, oldStatus);
    
    // Send status notification
    try {
      const patientParticipant = updatedAppointment.participant.find((p: any) => 
        p.actor.reference.startsWith('Patient/')
      );
      const practitionerParticipant = updatedAppointment.participant.find((p: any) => 
        p.actor.reference.startsWith('Practitioner/')
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
            statusMessage = 'You were marked as a no-show for your appointment. Please contact us to reschedule.';
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
          patientParticipant.actor.reference,
          practitionerParticipant.actor.reference,
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
    console.error(`Error in PUT /api/fhir/appointments/${id}:`, error);
    
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