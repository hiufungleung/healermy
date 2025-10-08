import type { Appointment } from '@/types/fhir';

/**
 * Enhanced appointment type with practitioner details for patient dashboard
 */
export interface AppointmentWithPractitionerDetails extends Appointment {
  practitionerDetails?: {
    name: string;
    specialty: string;
    address: string;
    phone: string;
  };
}

/**
 * Fetch and enhance appointments with practitioner details for patient dashboard
 * This function adds practitionerDetails object to appointments for patient view
 */
export async function enhanceAppointmentsWithPractitionerDetails(
  appointments: Appointment[]
): Promise<AppointmentWithPractitionerDetails[]> {
  try {
    if (appointments.length === 0) return appointments;

    // Extract unique practitioner IDs
    const practitionerIds = new Set<string>();
    appointments.forEach((appointment) => {
      const practitionerParticipant = appointment.participant?.find((p) =>
        p.actor?.reference?.startsWith('Practitioner/')
      );
      if (practitionerParticipant?.actor?.reference) {
        const practitionerId = practitionerParticipant.actor.reference.replace('Practitioner/', '');
        practitionerIds.add(practitionerId);
      }
    });

    // Fetch all practitioner details simultaneously
    const practitionerPromises = Array.from(practitionerIds).map(async (practitionerId) => {
      try {
        const practitionerResponse = await fetch(`/api/fhir/practitioners/${practitionerId}`, {
          credentials: 'include'
        });
        if (practitionerResponse.ok) {
          const practitionerData = await practitionerResponse.json();
          return { id: practitionerId, data: practitionerData };
        }
      } catch (error) {
        console.warn(`Failed to fetch practitioner ${practitionerId}:`, error);
      }
      return null;
    });

    // Wait for all practitioner API calls to complete
    const practitionerResults = await Promise.all(practitionerPromises);

    // Create a map of practitioner data for quick lookup
    const practitionersMap = new Map();
    practitionerResults.forEach((result) => {
      if (result) {
        practitionersMap.set(result.id, result.data);
      }
    });

    // Add practitioner details to appointments
    const enhancedAppointments = appointments.map((appointment): AppointmentWithPractitionerDetails => {
      const practitionerParticipant = appointment.participant?.find((p) =>
        p.actor?.reference?.startsWith('Practitioner/')
      );

      if (practitionerParticipant?.actor?.reference) {
        const practitionerId = practitionerParticipant.actor.reference.replace('Practitioner/', '');
        const practitionerData = practitionersMap.get(practitionerId);

        if (practitionerData) {
          return {
            ...appointment,
            practitionerDetails: {
              name: practitionerData.name?.[0] ?
                `${(practitionerData.name[0].prefix || []).join(' ')} ${(practitionerData.name[0].given || []).join(' ')} ${practitionerData.name[0].family || ''}`.trim() :
                'Provider',
              specialty: practitionerData.qualification?.[0]?.code?.text || 'General',
              address: practitionerData.address?.[0] ?
                [
                  ...(practitionerData.address[0].line || []),
                  practitionerData.address[0].city || practitionerData.address[0].district,
                  practitionerData.address[0].state,
                  practitionerData.address[0].postalCode
                ].filter(Boolean).join(', ') : 'TBD',
              phone: practitionerData.telecom?.find((t: any) => t.system === 'phone')?.value || 'N/A'
            }
          };
        }
      }

      return appointment;
    });

    return enhancedAppointments;
  } catch (error) {
    console.error('Error enhancing appointments with practitioner details:', error);
    return appointments; // Return original appointments on error
  }
}