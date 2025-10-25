import { NextRequest, NextResponse } from 'next/server';
import { FHIRClient } from '../../client';
import { getSessionFromCookies, prepareToken } from '../../utils/auth';

/**
 * POST /api/fhir/Encounter/create-for-appointment
 * Create an encounter for an appointment
 *
 * This endpoint is called by practitioners when they click "Will be finished in 10 minutes"
 * to create an encounter for the next patient with status='planned'
 *
 * Body: { appointmentId: string, initialStatus?: 'planned' | 'in-progress' }
 */
export async function POST(request: NextRequest) {
  try {
    // Extract session from middleware
    const session = await getSessionFromCookies();
    const token = prepareToken(session.accessToken);
    const fhirBaseUrl = session.fhirBaseUrl;

    // Only providers can create encounters
    if (session.role !== 'provider') {
      return NextResponse.json(
        { error: 'Forbidden: Only providers can create encounters' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { appointmentId, initialStatus = 'planned' } = body;

    if (!appointmentId) {
      return NextResponse.json(
        { error: 'appointmentId is required' },
        { status: 400 }
      );
    }

    // Validate initialStatus
    const validStatuses = ['planned', 'in-progress'];
    if (!validStatuses.includes(initialStatus)) {
      return NextResponse.json(
        { error: `Invalid initialStatus. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Fetch the appointment
    const appointmentResponse = await FHIRClient.fetchWithAuth(
      `${fhirBaseUrl}/Appointment/${appointmentId}`,
      token
    );

    if (!appointmentResponse.ok) {
      return NextResponse.json(
        { error: 'Appointment not found' },
        { status: 404 }
      );
    }

    const appointment = await appointmentResponse.json();

    // Validate appointment status is 'arrived' or 'booked'
    const validAppointmentStatuses = ['arrived', 'booked'];
    if (!validAppointmentStatuses.includes(appointment.status)) {
      return NextResponse.json(
        {
          error: `Cannot create encounter for appointment with status '${appointment.status}'. Appointment must be 'arrived' or 'booked'.`
        },
        { status: 400 }
      );
    }

    // Check if encounter already exists for this appointment
    const encounterSearchResponse = await FHIRClient.fetchWithAuth(
      `${fhirBaseUrl}/Encounter?appointment=Appointment/${appointmentId}&_count=1`,
      token
    );

    if (encounterSearchResponse.ok) {
      const encounterBundle = await encounterSearchResponse.json();
      if (encounterBundle.entry && encounterBundle.entry.length > 0) {
        const existingEncounter = encounterBundle.entry[0].resource;
        return NextResponse.json(
          {
            error: 'Encounter already exists for this appointment',
            encounter: existingEncounter
          },
          { status: 409 }
        );
      }
    }

    // Extract participant information from appointment
    const patientParticipant = appointment.participant?.find((p: any) =>
      p.actor?.reference?.startsWith('Patient/')
    );
    const practitionerParticipant = appointment.participant?.find((p: any) =>
      p.actor?.reference?.startsWith('Practitioner/')
    );

    if (!patientParticipant || !practitionerParticipant) {
      return NextResponse.json(
        { error: 'Appointment missing required participants (patient and practitioner)' },
        { status: 400 }
      );
    }

    // Create encounter resource
    const encounterData = {
      resourceType: 'Encounter',
      status: initialStatus,
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'AMB',
        display: 'ambulatory'
      },
      subject: {
        reference: patientParticipant.actor?.reference,
        display: patientParticipant.actor?.display
      },
      participant: [
        {
          type: [{
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
              code: 'PPRF',
              display: 'primary performer'
            }]
          }],
          individual: {
            reference: practitionerParticipant.actor?.reference,
            display: practitionerParticipant.actor?.display
          }
        }
      ],
      appointment: [{
        reference: `Appointment/${appointmentId}`,
        display: `Appointment ${appointmentId}`
      }],
      period: {
        start: appointment.start,
        end: appointment.end
      },
      reasonCode: appointment.reasonCode
    };

    // Create encounter via FHIR API
    const encounterResponse = await FHIRClient.fetchWithAuth(
      `${fhirBaseUrl}/Encounter`,
      token,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/fhir+json' },
        body: JSON.stringify(encounterData)
      }
    );

    if (!encounterResponse.ok) {
      const errorText = await encounterResponse.text();
      console.error('FHIR API error:', encounterResponse.status, errorText);
      return NextResponse.json(
        { error: 'Failed to create encounter', details: errorText },
        { status: encounterResponse.status }
      );
    }

    const createdEncounter = await encounterResponse.json();
    console.log(`✅ Created encounter ${createdEncounter.id} for appointment ${appointmentId} with status '${initialStatus}'`);

    return NextResponse.json(createdEncounter, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/fhir/Encounter/create-for-appointment:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
