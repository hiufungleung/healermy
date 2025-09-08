'use server';

import { getValidatedSession } from '@/library/auth/session';
import { getPatient, searchAppointments } from '@/library/fhir/client';
import type { Patient, Appointment } from '@/types/fhir';

export async function getDashboardData(): Promise<{
  patient: Patient | null;
  appointments: Appointment[];
  session: import('@/types/auth').AuthSession | null;
  error?: string;
}> {
  try {
    // Get session data from middleware (already decrypted and validated)
    const { session, error } = await getValidatedSession();
    
    if (error || !session) {
      return {
        patient: null,
        appointments: [],
        session,
        error: error || 'No session found'
      };
    }

    // Additional validation for patient-specific data
    if (!session.patient) {
      return {
        patient: null,
        appointments: [],
        session,
        error: 'No patient ID in session'
      };
    }

    // Fetch patient information first - this is critical
    let patientData: Patient | null = null;
    let appointmentData: Appointment[] = [];
    
    try {
      // Use decrypted tokens from middleware - session.accessToken is guaranteed to exist from validation
      patientData = await getPatient(session.accessToken!, session.fhirBaseUrl, session.patient!);
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
      appointmentData = await searchAppointments(session.accessToken!, session.fhirBaseUrl, session.patient!);
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