import { getSessionFromCookies, prepareToken } from '@/app/api/fhir/utils/auth';
import { Layout } from '@/components/common/Layout';
import { FHIRClient } from '@/app/api/fhir/client';
import AppointmentDetailClient from './AppointmentDetailClient';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Appointment Details',
  description: 'View appointment details and information',
};

// Extract patient name from FHIR Patient resource
function extractPatientName(patient: any): string {
  if (!patient?.name?.[0]) return 'Patient';
  
  const name = patient.name[0];
  const given = Array.isArray(name.given) ? name.given.join(' ') : name.given || '';
  const family = name.family || '';
  
  return `${given} ${family}`.trim() || 'Patient';
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PatientAppointmentDetailPage({ params }: PageProps) {
  const { id: appointmentId } = await params;
  
  try {
    // Get session from middleware headers
    const session = await getSessionFromCookies();
    const token = prepareToken(session.accessToken);
    
    // Get patient information
    let patient = null;
    let patientName = 'Patient';
    
    if (session.patient) {
      try {
        const patientResponse = await FHIRClient.fetchWithAuth(
          `${session.fhirBaseUrl}/Patient/${session.patient}`,
          token
        );
        
        if (patientResponse.ok) {
          patient = await patientResponse.json();
          patientName = extractPatientName(patient);
        }
      } catch (error) {
        console.error('Error fetching patient data:', error);
      }
    }
    
    // Fetch appointment details
    let appointment = null;
    try {
      const appointmentResponse = await FHIRClient.fetchWithAuth(
        `${session.fhirBaseUrl}/Appointment/${appointmentId}`,
        token
      );
      
      if (!appointmentResponse.ok) {
        if (appointmentResponse.status === 404) {
          notFound();
        }
        throw new Error(`Failed to fetch appointment: ${appointmentResponse.statusText}`);
      }
      
      appointment = await appointmentResponse.json();
      
      // Verify this appointment belongs to the current patient
      const patientParticipant = appointment.participant?.find((p: any) => 
        p.actor?.reference?.startsWith('Patient/')
      );
      
      const appointmentPatientId = patientParticipant?.actor?.reference?.replace('Patient/', '');
      
      if (appointmentPatientId !== session.patient) {
        // Patient trying to access someone else's appointment
        return (
          <Layout patientName={patientName}>
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-red-600 mb-4">Not Authorized</h1>
                <p className="text-text-secondary mb-6">
                  You are not authorized to view this appointment.
                </p>
                <a href="/patient/dashboard" className="text-primary hover:underline">
                  Return to Dashboard
                </a>
              </div>
            </div>
          </Layout>
        );
      }
      
    } catch (error) {
      console.error('Error fetching appointment:', error);
      
      return (
        <Layout patientName={patientName}>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-red-600 mb-4">Error Loading Appointment</h1>
              <p className="text-text-secondary mb-6">
                There was an error loading the appointment details. Please try again later.
              </p>
              <a href="/patient/dashboard" className="text-primary hover:underline">
                Return to Dashboard
              </a>
            </div>
          </div>
        </Layout>
      );
    }
    
    // Fetch practitioner details if available
    let practitioner = null;
    const practitionerParticipant = appointment.participant?.find((p: any) => 
      p.actor?.reference?.startsWith('Practitioner/')
    );
    
    if (practitionerParticipant?.actor?.reference) {
      try {
        const practitionerResponse = await FHIRClient.fetchWithAuth(
          `${session.fhirBaseUrl}/${practitionerParticipant.actor.reference}`,
          token
        );
        
        if (practitionerResponse.ok) {
          practitioner = await practitionerResponse.json();
        }
      } catch (error) {
        console.error('Error fetching practitioner data:', error);
      }
    }
    
    return (
      <Layout patientName={patientName}>
        <AppointmentDetailClient 
          patient={patient}
          appointment={appointment}
          practitioner={practitioner}
          patientName={patientName}
        />
      </Layout>
    );
    
  } catch (error) {
    console.error('Error in patient appointment detail page:', error);
    
    return (
      <Layout patientName="Patient">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
            <p className="text-text-secondary mb-6">
              There was an error loading the appointment. Please try again later.
            </p>
            <a href="/patient/dashboard" className="text-primary hover:underline">
              Return to Dashboard
            </a>
          </div>
        </div>
      </Layout>
    );
  }
}