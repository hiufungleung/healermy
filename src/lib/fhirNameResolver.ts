import type { Appointment, Patient, Practitioner } from '@/types/fhir';

/**
 * Extract unique patient and practitioner IDs from appointments
 */
export function extractParticipantIds(appointments: Appointment[]) {
  const patientIds = new Set<string>();
  const practitionerIds = new Set<string>();

  appointments.forEach((appointment) => {
    const patientParticipant = appointment.participant?.find(p =>
      p.actor?.reference?.startsWith('Patient/')
    );
    const practitionerParticipant = appointment.participant?.find(p =>
      p.actor?.reference?.startsWith('Practitioner/')
    );

    if (patientParticipant?.actor?.reference) {
      const patientId = patientParticipant.actor.reference.replace('Patient/', '');
      patientIds.add(patientId);
    }
    if (practitionerParticipant?.actor?.reference) {
      const practitionerId = practitionerParticipant.actor.reference.replace('Practitioner/', '');
      practitionerIds.add(practitionerId);
    }
  });

  return { patientIds, practitionerIds };
}

/**
 * Fetch patient data for multiple patient IDs
 */
export async function fetchPatientData(patientIds: Set<string>) {
  const patientPromises = Array.from(patientIds).map(async (patientId) => {
    try {
      const response = await fetch(`/api/fhir/Patient/${patientId}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const patientData = await response.json();
        return { id: patientId, data: patientData };
      }
    } catch (error) {
      console.warn(`Failed to fetch patient ${patientId}:`, error);
    }
    return null;
  });

  const results = await Promise.all(patientPromises);
  const patientsMap = new Map();

  results.forEach((result) => {
    if (result) {
      patientsMap.set(result.id, result.data);
    }
  });

  return patientsMap;
}

/**
 * Fetch practitioner data for multiple practitioner IDs
 */
export async function fetchPractitionerData(practitionerIds: Set<string>) {
  const practitionerPromises = Array.from(practitionerIds).map(async (practitionerId) => {
    try {
      const response = await fetch(`/api/fhir/Practitioner/${practitionerId}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const practitionerData = await response.json();
        return { id: practitionerId, data: practitionerData };
      }
    } catch (error) {
      console.warn(`Failed to fetch practitioner ${practitionerId}:`, error);
    }
    return null;
  });

  const results = await Promise.all(practitionerPromises);
  const practitionersMap = new Map();

  results.forEach((result) => {
    if (result) {
      practitionersMap.set(result.id, result.data);
    }
  });

  return practitionersMap;
}

/**
 * Extract full name from FHIR name object
 */
export function extractFullName(nameObj?: { name?: Array<{ given?: string[]; family?: string }> }): string | null {
  if (!nameObj?.name?.[0]) return null;

  const name = nameObj.name[0];
  const fullName = [name.given?.join(' '), name.family].filter(Boolean).join(' ');
  return fullName || null;
}

/**
 * Update appointment participants with resolved names
 */
export function updateAppointmentNames(
  appointments: Appointment[],
  patientsMap: Map<string, Patient>,
  practitionersMap: Map<string, Practitioner>
): Appointment[] {
  return appointments.map((appointment) => {
    const updatedAppointment = { ...appointment };

    // Update patient name
    const patientParticipant = updatedAppointment.participant?.find(p =>
      p.actor?.reference?.startsWith('Patient/')
    );
    if (patientParticipant?.actor?.reference) {
      const patientId = patientParticipant.actor.reference.replace('Patient/', '');
      const patientData = patientsMap.get(patientId);
      const fullName = extractFullName(patientData);
      if (fullName) {
        patientParticipant.actor.display = fullName;
      }
    }

    // Update practitioner name
    const practitionerParticipant = updatedAppointment.participant?.find(p =>
      p.actor?.reference?.startsWith('Practitioner/')
    );
    if (practitionerParticipant?.actor?.reference) {
      const practitionerId = practitionerParticipant.actor.reference.replace('Practitioner/', '');
      const practitionerData = practitionersMap.get(practitionerId);
      const fullName = extractFullName(practitionerData);
      if (fullName) {
        practitionerParticipant.actor.display = fullName;
      }
    }

    return updatedAppointment;
  });
}

/**
 * Main function to enhance appointments with real patient and practitioner names
 */
export async function enhanceAppointmentsWithNames(appointments: Appointment[]): Promise<Appointment[]> {
  try {
    if (appointments.length === 0) return appointments;

    // Extract unique IDs
    const { patientIds, practitionerIds } = extractParticipantIds(appointments);

    // Fetch all data simultaneously
    const [patientsMap, practitionersMap] = await Promise.all([
      fetchPatientData(patientIds),
      fetchPractitionerData(practitionerIds)
    ]);

    // Update appointments with resolved names
    return updateAppointmentNames(appointments, patientsMap, practitionersMap);
  } catch (error) {
    console.error('Error enhancing appointments with names:', error);
    return appointments; // Return original appointments on error
  }
}