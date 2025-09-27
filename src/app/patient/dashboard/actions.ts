'use server';

import { headers } from 'next/headers';
import { getPatient } from '@/app/api/fhir/patients/operations';
import { searchAppointments } from '@/app/api/fhir/appointments/operations';
import type { Patient, Appointment } from '@/types/fhir';
import type { AuthSession } from '@/types/auth';

// Server action that gets session data only (no FHIR API calls for fast page render)
export async function getSessionOnly(): Promise<{
  session: AuthSession | null;
  error?: string;
}> {
  try {
    // Get session directly from middleware headers (already decrypted and validated)
    const headersList = await headers();
    const sessionHeader = headersList.get('x-session-data');

    if (!sessionHeader) {
      return {
        session: null,
        error: 'No session found'
      };
    }

    const session: AuthSession = JSON.parse(sessionHeader);

    // Additional validation for required fields
    if (!session.patient || !session.accessToken || !session.fhirBaseUrl) {
      return {
        session,
        error: 'Incomplete session data'
      };
    }

    return {
      session
    };
  } catch (error) {
    console.error('Error getting session data:', error);
    return {
      session: null,
      error: 'Failed to get session data'
    };
  }
}

// Original function kept for backwards compatibility and direct use
export async function getDashboardData(): Promise<{
  patient: Patient | null;
  appointments: Appointment[];
  session: AuthSession | null;
  error?: string;
}> {
  try {
    // Get session directly from middleware headers (already decrypted and validated)
    const headersList = await headers();
    const sessionHeader = headersList.get('x-session-data');

    if (!sessionHeader) {
      return {
        patient: null,
        appointments: [],
        session: null,
        error: 'No session found'
      };
    }

    const session: AuthSession = JSON.parse(sessionHeader);

    // Additional validation for required fields
    if (!session.patient || !session.accessToken || !session.fhirBaseUrl) {
      return {
        patient: null,
        appointments: [],
        session,
        error: 'Incomplete session data'
      };
    }

    // Fetch patient information first - this is critical
    let patientData: Patient | null = null;
    let appointmentData: Appointment[] = [];

    try {
      // Use decrypted tokens from middleware - all fields validated above
      patientData = await getPatient(session.accessToken, session.fhirBaseUrl, session.patient);
    } catch (error) {
      console.error('Error fetching patient data:', error);
      return {
        patient: null,
        appointments: [],
        session,
        error: 'Failed to fetch patient data'
      };
    }

    // Try to fetch appointments, but don't fail if this doesn't work
    try {
      const appointmentBundle = await searchAppointments(
        session.accessToken,
        session.fhirBaseUrl,
        session.patient,
        undefined, // practitionerId
        undefined, // status
        undefined, // dateFrom (will use default)
        undefined  // dateTo (will use default)
      );

      // Extract appointments from Bundle
      if (appointmentBundle?.entry) {
        appointmentData = appointmentBundle.entry.map((entry: any) => entry.resource).filter(Boolean);
      }
    } catch (error) {
      console.error('Error fetching appointments (will use mock data):', error);
      // Don't return error here - just use empty appointments array
    }

    return {
      patient: patientData,
      appointments: appointmentData,
      session
    };
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return {
      patient: null,
      appointments: [],
      session: null,
      error: 'Failed to fetch dashboard data'
    };
  }
}