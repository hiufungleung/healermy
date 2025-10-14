import { FHIRClient } from '../client';

/**
 * Search schedules by practitioner ID - Direct FHIR query approach
 * Supports batch fetching via _id: "12345,67890,11111"
 */
export async function searchSchedules(
  token: string,
  fhirBaseUrl: string,
  searchOptions?: {
    _id?: string;     // Single ID or comma-separated IDs for batch fetch
    actor?: string;   // Practitioner/{id}
    date?: string;    // Date range with ge/le comparators
    specialty?: string;
    serviceCategory?: string;
    serviceType?: string;
    _count?: number;
  }
): Promise<any> {
  const queryParams = new URLSearchParams();

  // Add search parameters directly as provided
  // Map to FHIR standard parameter names
  if (searchOptions) {
    Object.entries(searchOptions).forEach(([key, value]) => {
      if (value !== undefined) {
        // Map serviceType to service-type (FHIR standard)
        const paramName = key === 'serviceType' ? 'service-type' : key;
        // Map serviceCategory to service-category (FHIR standard)
        const finalParamName = paramName === 'serviceCategory' ? 'service-category' : paramName;
        queryParams.append(finalParamName, value.toString());
      }
    });
  }

  const url = `${fhirBaseUrl}/Schedule?${queryParams.toString()}`;
  console.log('Schedule query URL:', url);

  const response = await FHIRClient.fetchWithAuth(url, token);
  const result = await response.json();

  console.log('Schedule query result:', result);
  return result;
}

/**
 * Get a schedule by ID
 */
export async function getSchedule(
  token: string,
  fhirBaseUrl: string,
  scheduleId: string
): Promise<any> {
  const url = `${fhirBaseUrl}/Schedule/${scheduleId}`;
  const response = await FHIRClient.fetchWithAuth(url, token);
  return response.json();
}

/**
 * Create a new schedule
 */
export async function createSchedule(
  token: string,
  fhirBaseUrl: string,
  scheduleData: any
): Promise<any> {
  const url = `${fhirBaseUrl}/Schedule`;
  const response = await FHIRClient.fetchWithAuth(url, token, {
    method: 'POST',
    body: JSON.stringify(scheduleData),
  });
  return response.json();
}

/**
 * Update an existing schedule
 */
export async function updateSchedule(
  token: string,
  fhirBaseUrl: string,
  scheduleId: string,
  scheduleData: any
): Promise<any> {
  const url = `${fhirBaseUrl}/Schedule/${scheduleId}`;
  const response = await FHIRClient.fetchWithAuth(url, token, {
    method: 'PUT',
    body: JSON.stringify(scheduleData),
  });
  return response.json();
}

/**
 * Delete a schedule and all associated slots and appointments
 */
export async function deleteSchedule(
  token: string,
  fhirBaseUrl: string,
  scheduleId: string
): Promise<any> {
  try {
    // Step 1: Find all slots associated with this schedule
    const slotsResponse = await FHIRClient.fetchWithAuth(
      `${fhirBaseUrl}/Slot?schedule=Schedule/${scheduleId}&_count=1000`,
      token
    );

    const slotsBundle = await slotsResponse.json();
    const slots = slotsBundle.entry?.map((entry: any) => entry.resource) || [];

    console.log(`Found ${slots.length} slots to delete for schedule ${scheduleId}`);

    // Step 2: Find all appointments referencing these slots
    let allAppointments: any[] = [];
    if (slots.length > 0) {
      // Search for appointments that reference any of these slots
      const appointmentPromises = slots.map(async (slot: any) => {
        try {
          const appointmentResponse = await FHIRClient.fetchWithAuth(
            `${fhirBaseUrl}/Appointment?slot=Slot/${slot.id}&_count=1000`,
            token
          );
          const appointmentBundle = await appointmentResponse.json();
          return appointmentBundle.entry?.map((entry: any) => entry.resource) || [];
        } catch (error) {
          console.warn(`Failed to search appointments for slot ${slot.id}:`, error);
          return [];
        }
      });

      const appointmentResults = await Promise.all(appointmentPromises);
      allAppointments = appointmentResults.flat();

      // Remove duplicates (in case appointments reference multiple slots)
      const uniqueAppointments = allAppointments.filter((appointment, index, self) =>
        index === self.findIndex((a) => a.id === appointment.id)
      );
      allAppointments = uniqueAppointments;
    }

    console.log(`Found ${allAppointments.length} appointments to delete for schedule ${scheduleId}`);

    // Step 3: Delete all appointments first
    const deleteAppointmentPromises = allAppointments.map(async (appointment: any) => {
      try {
        const deleteResponse = await FHIRClient.fetchWithAuth(
          `${fhirBaseUrl}/Appointment/${appointment.id}`,
          token,
          { method: 'DELETE' }
        );
        return { appointmentId: appointment.id, success: deleteResponse.ok };
      } catch (error) {
        console.warn(`Failed to delete appointment ${appointment.id}:`, error);
        return { appointmentId: appointment.id, success: false, error };
      }
    });

    const appointmentResults = await Promise.allSettled(deleteAppointmentPromises);
    const successfulAppointmentDeletions = appointmentResults.filter(result =>
      result.status === 'fulfilled' && result.value.success
    ).length;

    console.log(`Successfully deleted ${successfulAppointmentDeletions}/${allAppointments.length} appointments`);

    // Step 4: Delete all associated slots
    const deleteSlotPromises = slots.map(async (slot: any) => {
      try {
        const deleteResponse = await FHIRClient.fetchWithAuth(
          `${fhirBaseUrl}/Slot/${slot.id}`,
          token,
          { method: 'DELETE' }
        );
        return { slotId: slot.id, success: deleteResponse.ok };
      } catch (error) {
        console.warn(`Failed to delete slot ${slot.id}:`, error);
        return { slotId: slot.id, success: false, error };
      }
    });

    const slotResults = await Promise.allSettled(deleteSlotPromises);
    const successfulSlotDeletions = slotResults.filter(result =>
      result.status === 'fulfilled' && result.value.success
    ).length;

    console.log(`Successfully deleted ${successfulSlotDeletions}/${slots.length} slots`);

    // Step 5: Finally delete the schedule
    const scheduleResponse = await FHIRClient.fetchWithAuth(
      `${fhirBaseUrl}/Schedule/${scheduleId}`,
      token,
      { method: 'DELETE' }
    );

    if (scheduleResponse.ok) {
      return {
        success: true,
        message: `Schedule deleted successfully. ${successfulAppointmentDeletions} appointments, ${successfulSlotDeletions} slots were also deleted.`,
        appointmentsDeleted: successfulAppointmentDeletions,
        totalAppointments: allAppointments.length,
        slotsDeleted: successfulSlotDeletions,
        totalSlots: slots.length
      };
    } else {
      const errorData = await scheduleResponse.json();
      throw new Error(`Failed to delete schedule: ${JSON.stringify(errorData)}`);
    }

  } catch (error) {
    console.error('Error in deleteSchedule:', error);
    throw error;
  }
}