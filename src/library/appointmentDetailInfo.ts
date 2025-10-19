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

    // Fetch all practitioners in a single batch request using FHIR _id parameter
    const practitionersMap = new Map();

    if (practitionerIds.size > 0) {
      try {
        // Use FHIR standard _id parameter with comma-separated IDs
        const idsParam = Array.from(practitionerIds).join(',');
        const practitionersResponse = await fetch(`/api/fhir/practitioners?_id=${idsParam}`, {
          credentials: 'include'
        });

        if (practitionersResponse.ok) {
          const practitionersData = await practitionersResponse.json();
          const practitioners = practitionersData.practitioners || [];

          // Create map with practitioner ID as key
          practitioners.forEach((practitioner: any) => {
            if (practitioner.id) {
              practitionersMap.set(practitioner.id, practitioner);
            }
          });
        }
      } catch (error) {
        console.warn('Failed to fetch practitioners in batch:', error);
      }
    }

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